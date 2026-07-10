import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DetectLabelsCommand, RekognitionClient } from "@aws-sdk/client-rekognition";
import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

declare const process: {
  env: {
    METADATA_TABLE_NAME?: string;
  };
};

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const rekognitionClient = new RekognitionClient({});
const s3Client = new S3Client({});
const fileIdPattern =
  /^uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;
const maxStoredTextLength = 12000;

export const main = async (event: any) => {
  console.log("Received SQS event:", JSON.stringify(event, null, 2));

  for (const record of event.Records || []) {
    const body = JSON.parse(record.body);
    console.log("S3 event received:", JSON.stringify(body, null, 2));

    for (const s3Record of body.Records || []) {
      const bucket = s3Record.s3.bucket.name;
      const objectKey = decodeURIComponent(
        s3Record.s3.object.key.replace(/\+/g, " ")
      );
      const parsedObjectKey = parseUploadedObjectKey(objectKey);
      const uploadedAt = s3Record.eventTime || new Date().toISOString();
      const processedAt = new Date().toISOString();
      const objectMetadata = await s3Client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        })
      );
      const fileType = objectMetadata.ContentType || inferFileType(parsedObjectKey.originalFileName);
      const mediaType = getMediaType(fileType);

      if (mediaType === "document") {
        const extraction = await extractDocumentText({
          bucket,
          objectKey,
          fileType,
        });
        const documentStatus =
          extraction.status === "FAILED"
            ? "FAILED"
            : extraction.status === "UNSUPPORTED"
            ? "DOCUMENT_PENDING"
            : "PROCESSED";
        const documentItem = {
          fileId: parsedObjectKey.fileId,
          bucket,
          objectKey,
          originalFileName: parsedObjectKey.originalFileName,
          fileSize: s3Record.s3.object.size,
          fileType,
          mediaType,
          status: documentStatus,
          uploadedAt,
          processedAt,
          source: "S3_EVENT",
          extractionStatus: extraction.status,
          extractedText: extraction.text,
          textPreview: extraction.preview,
          wordCount: extraction.wordCount,
          documentInsights: extraction.insights,
          errorMessage: extraction.errorMessage,
        };

        await writeMetadata(documentItem);
        console.log("Document metadata record written:", JSON.stringify(documentItem, null, 2));
        continue;
      }

      try {
        const labelsResponse = await rekognitionClient.send(
          new DetectLabelsCommand({
            Image: {
              S3Object: {
                Bucket: bucket,
                Name: objectKey,
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

        const item = {
          fileId: parsedObjectKey.fileId,
          bucket,
          objectKey,
          originalFileName: parsedObjectKey.originalFileName,
          fileSize: s3Record.s3.object.size,
          fileType,
          mediaType,
          status: "PROCESSED",
          uploadedAt,
          processedAt,
          labels,
          source: "S3_EVENT",
        };

        await writeMetadata(item);
        console.log("Metadata record written:", JSON.stringify(item, null, 2));
      } catch (error) {
        console.error("Media processing failed", error);

        const failedItem = {
          fileId: parsedObjectKey.fileId,
          bucket,
          objectKey,
          originalFileName: parsedObjectKey.originalFileName,
          fileSize: s3Record.s3.object.size,
          fileType,
          mediaType,
          status: "FAILED",
          uploadedAt,
          processedAt,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Media processing failed.",
          source: "S3_EVENT",
        };

        await writeMetadata(failedItem);
        console.log("Failure metadata record written:", JSON.stringify(failedItem, null, 2));
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Media metadata stored" }),
  };
};

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
    console.error("Document extraction failed", error);

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
