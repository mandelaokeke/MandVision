import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DetectLabelsCommand, RekognitionClient } from "@aws-sdk/client-rekognition";

declare const process: {
  env: {
    METADATA_TABLE_NAME?: string;
  };
};

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const rekognitionClient = new RekognitionClient({});
const fileIdPattern =
  /^uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;

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
  await docClient.send(
    new PutCommand({
      TableName: process.env.METADATA_TABLE_NAME!,
      Item: item,
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
