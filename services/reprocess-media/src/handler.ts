import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { DetectLabelsCommand, RekognitionClient } from "@aws-sdk/client-rekognition";

declare const process: {
  env: {
    METADATA_TABLE_NAME?: string;
  };
};

type MediaItem = {
  fileId: string;
  bucket?: string;
  objectKey?: string;
  originalFileName?: string;
  uploadedAt?: string;
  fileSize?: number;
  [key: string]: unknown;
};

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const rekognitionClient = new RekognitionClient({});
const fileIdPattern =
  /^uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "OPTIONS,POST",
};

export const main = async (event: any) => {
  try {
    const fileId = event.pathParameters?.fileId;

    if (!fileId) {
      return response(400, { message: "fileId is required" });
    }

    const existingItem = await findMediaItem(fileId);

    if (!existingItem) {
      return response(404, { message: "Media item not found" });
    }

    if (!existingItem.bucket || !existingItem.objectKey) {
      return response(400, {
        message: "This media item does not have enough storage metadata to reprocess.",
      });
    }

    const parsedObjectKey = parseUploadedObjectKey(existingItem.objectKey);
    const fileType =
      typeof existingItem.fileType === "string"
        ? existingItem.fileType
        : inferFileType(parsedObjectKey.originalFileName);
    const mediaType =
      typeof existingItem.mediaType === "string"
        ? existingItem.mediaType
        : getMediaType(fileType);

    if (mediaType === "document") {
      return response(400, {
        message: "Document extraction is staged for the next document processing step.",
      });
    }

    const processedAt = new Date().toISOString();

    try {
      const labelsResponse = await rekognitionClient.send(
        new DetectLabelsCommand({
          Image: {
            S3Object: {
              Bucket: existingItem.bucket,
              Name: existingItem.objectKey,
            },
          },
          MaxLabels: 20,
          MinConfidence: 70,
        })
      );

      const labels =
        labelsResponse.Labels?.map((label) => ({
          name: label.Name,
          confidence: label.Confidence,
        })).filter((label) => label.name) || [];

      const repairedItem = {
        ...existingItem,
        fileId: parsedObjectKey.fileId,
        originalFileName:
          existingItem.originalFileName || parsedObjectKey.originalFileName,
        fileType,
        mediaType,
        status: "PROCESSED",
        processedAt,
        labels,
        source: "REPROCESS",
      };

      await writeMetadata(repairedItem);
      await deleteOldRecordIfNeeded(fileId, repairedItem.fileId);

      return response(200, repairedItem);
    } catch (error) {
      console.error("Reprocess failed", error);

      const failedItem = {
        ...existingItem,
        fileId: parsedObjectKey.fileId,
        originalFileName:
          existingItem.originalFileName || parsedObjectKey.originalFileName,
        fileType,
        mediaType,
        status: "FAILED",
        processedAt,
        errorMessage:
          error instanceof Error ? error.message : "Media reprocessing failed.",
        source: "REPROCESS",
      };

      await writeMetadata(failedItem);
      await deleteOldRecordIfNeeded(fileId, failedItem.fileId);

      return response(200, failedItem);
    }
  } catch (error) {
    console.error("Reprocess media error:", error);
    return response(500, { message: "Could not reprocess media item" });
  }
};

async function findMediaItem(fileId: string): Promise<MediaItem | null> {
  const directResult = await docClient.send(
    new GetCommand({
      TableName: process.env.METADATA_TABLE_NAME!,
      Key: { fileId },
    })
  );

  if (directResult.Item) {
    return directResult.Item as MediaItem;
  }

  const scanResult = await docClient.send(
    new ScanCommand({
      TableName: process.env.METADATA_TABLE_NAME!,
      FilterExpression: "contains(objectKey, :fileId)",
      ExpressionAttributeValues: {
        ":fileId": fileId,
      },
      Limit: 1,
    })
  );

  return (scanResult.Items?.[0] as MediaItem | undefined) || null;
}

async function writeMetadata(item: Record<string, unknown>) {
  await docClient.send(
    new PutCommand({
      TableName: process.env.METADATA_TABLE_NAME!,
      Item: item,
    })
  );
}

async function deleteOldRecordIfNeeded(oldFileId: string, nextFileId: string) {
  if (oldFileId === nextFileId) return;

  await docClient.send(
    new DeleteCommand({
      TableName: process.env.METADATA_TABLE_NAME!,
      Key: { fileId: oldFileId },
    })
  );
}

function parseUploadedObjectKey(objectKey: string) {
  const match = objectKey.match(fileIdPattern);

  if (match) {
    return {
      fileId: match[1],
      originalFileName: match[2],
    };
  }

  const fallbackFileName = objectKey.split("/").pop() || objectKey;

  return {
    fileId: fallbackFileName,
    originalFileName: fallbackFileName,
  };
}

function getMediaType(fileType: string) {
  if (fileType.startsWith("image/")) return "image";

  if (
    fileType === "application/pdf" ||
    fileType === "application/msword" ||
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "document";
  }

  return "unknown";
}

function inferFileType(fileName: string) {
  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName.endsWith(".jpg") || lowerFileName.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lowerFileName.endsWith(".png")) {
    return "image/png";
  }

  if (lowerFileName.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (lowerFileName.endsWith(".doc")) {
    return "application/msword";
  }

  if (lowerFileName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  return "application/octet-stream";
}

function response(statusCode: number, body: object) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}
