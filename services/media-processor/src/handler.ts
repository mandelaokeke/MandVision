import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

declare const process: {
  env: {
    METADATA_TABLE_NAME?: string;
  };
};

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

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

      const fileName = objectKey.split("/").pop() || objectKey;
      const fileId = fileName.split("-")[0] || `file-${Date.now()}`;
      const uploadedAt = s3Record.eventTime || new Date().toISOString();

      const item = {
        fileId,
        bucket,
        objectKey,
        originalFileName: fileName,
        status: "RECEIVED",
        uploadedAt,
        processedAt: new Date().toISOString(),
        source: "S3_EVENT",
      };

      await docClient.send(
        new PutCommand({
          TableName: process.env.METADATA_TABLE_NAME!,
          Item: item,
        })
      );

      console.log("Metadata record written:", JSON.stringify(item, null, 2));
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Media metadata stored" }),
  };
};
