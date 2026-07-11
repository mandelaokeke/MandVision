import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { DetectLabelsCommand, RekognitionClient } from "@aws-sdk/client-rekognition";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DetectDocumentTextCommand, TextractClient } from "@aws-sdk/client-textract";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

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
const s3Client = new S3Client({});
const textractClient = new TextractClient({});
const fileIdPattern =
  /^uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;
const maxStoredTextLength = 12000;

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
      const processedAt = new Date().toISOString();
      const extraction = await extractDocumentText({
        bucket: existingItem.bucket,
        objectKey: existingItem.objectKey,
        fileType,
      });
      const documentStatus =
        extraction.status === "FAILED"
          ? "FAILED"
          : extraction.status === "UNSUPPORTED"
          ? "DOCUMENT_PENDING"
          : "PROCESSED";
      const repairedItem = {
        ...existingItem,
        fileId: parsedObjectKey.fileId,
        originalFileName:
          existingItem.originalFileName || parsedObjectKey.originalFileName,
        fileType,
        mediaType,
        status: documentStatus,
        processedAt,
        source: "REPROCESS",
        extractionStatus: extraction.status,
        extractedText: extraction.text,
        textPreview: extraction.preview,
        wordCount: extraction.wordCount,
        documentInsights: extraction.insights,
        errorMessage: extraction.errorMessage,
      };

      await writeMetadata(repairedItem);
      await deleteOldRecordIfNeeded(fileId, repairedItem.fileId);

      return response(200, repairedItem);
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
  const cleanItem = Object.fromEntries(
    Object.entries(item).filter(([, value]) => value !== undefined)
  );

  await docClient.send(
    new PutCommand({
      TableName: process.env.METADATA_TABLE_NAME!,
      Item: cleanItem,
    })
  );
}

async function extractDocumentText({
  bucket,
  objectKey,
  fileType,
}: {
  bucket: string;
  objectKey: string;
  fileType: string;
}) {
  try {
    if (fileType === "application/msword") {
      return {
        status: "UNSUPPORTED",
        text: "",
        preview: "Legacy DOC extraction is not enabled yet. Upload DOCX or PDF for text extraction.",
        wordCount: 0,
        insights: createEmptyDocumentInsights(),
      };
    }

    const object = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      })
    );
    const buffer = await streamToBuffer(object.Body);
    let extractedText = "";

    if (fileType === "application/pdf") {
      const result = await pdfParse(buffer);
      extractedText = result.text || "";

      if (!normalizeExtractedText(extractedText)) {
        extractedText = await extractTextWithTextract(bucket, objectKey);
      }
    }

    if (
      fileType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value || "";
    }

    const normalizedText = normalizeExtractedText(extractedText);

    return {
      status: normalizedText ? "COMPLETE" : "EMPTY",
      text: normalizedText.slice(0, maxStoredTextLength),
      preview: normalizedText.slice(0, 500),
      wordCount: countWords(normalizedText),
      insights: extractDocumentInsights(normalizedText),
    };
  } catch (error) {
    console.error("Document re-extraction failed", error);

    return {
      status: "FAILED",
      text: "",
      preview: "",
      wordCount: 0,
      insights: createEmptyDocumentInsights(),
      errorMessage:
        error instanceof Error ? error.message : "Document extraction failed.",
    };
  }
}

async function extractTextWithTextract(bucket: string, objectKey: string) {
  const result = await textractClient.send(
    new DetectDocumentTextCommand({
      Document: {
        S3Object: {
          Bucket: bucket,
          Name: objectKey,
        },
      },
    })
  );

  return (result.Blocks || [])
    .filter((block) => block.BlockType === "LINE" && block.Text)
    .map((block) => block.Text)
    .join("\n");
}

async function streamToBuffer(stream: unknown) {
  if (!stream || typeof (stream as any).transformToByteArray !== "function") {
    throw new Error("Could not read document from storage.");
  }

  const bytes = await (stream as any).transformToByteArray();
  return Buffer.from(bytes);
}

function normalizeExtractedText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function countWords(value: string) {
  if (!value) return 0;
  return value.split(/\s+/).filter(Boolean).length;
}

function extractDocumentInsights(text: string) {
  if (!text) return createEmptyDocumentInsights();

  return {
    emails: uniqueMatches(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, 10),
    phoneNumbers: uniqueMatches(
      text,
      /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g,
      10
    ),
    dates: uniqueMatches(
      text,
      /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4})\b/gi,
      10
    ),
    amounts: uniqueMatches(
      text,
      /(?:\$|USD\s*)\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/gi,
      10
    ),
    identifiers: uniqueMatches(
      text,
      /\b(?:invoice|receipt|order|account|reference|ref|id|number|no\.?)\s*[:#-]?\s*[A-Z0-9][A-Z0-9-]{2,}\b/gi,
      10
    ),
  };
}

function uniqueMatches(text: string, pattern: RegExp, limit: number) {
  const values = new Set<string>();
  const matches = text.match(pattern) || [];

  for (const match of matches) {
    const cleanValue = match.replace(/\s+/g, " ").trim();
    if (cleanValue) values.add(cleanValue);
    if (values.size >= limit) break;
  }

  return Array.from(values);
}

function createEmptyDocumentInsights() {
  return {
    emails: [],
    phoneNumbers: [],
    dates: [],
    amounts: [],
    identifiers: [],
  };
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
