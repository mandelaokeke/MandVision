import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { RekognitionClient, DetectLabelsCommand } from "@aws-sdk/client-rekognition";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

declare const process: {
  env: {
    METADATA_TABLE_NAME?: string;
    CONNECTIONS_TABLE_NAME?: string;
    WEBSOCKET_API_ENDPOINT?: string;
  };
};

declare const Buffer: {
  from(input: string): Uint8Array;
};

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const rekognitionClient = new RekognitionClient({});

const apiGatewayClient = new ApiGatewayManagementApiClient({
  endpoint: process.env.WEBSOCKET_API_ENDPOINT,
});

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

      const rekognitionResult = await rekognitionClient.send(
        new DetectLabelsCommand({
          Image: {
            S3Object: {
              Bucket: bucket,
              Name: objectKey,
            },
          },
          MaxLabels: 10,
          MinConfidence: 70,
        })
      );

      const labels =
        rekognitionResult.Labels?.map((label) => ({
          name: label.Name,
          confidence: label.Confidence,
        })) || [];

      const item = {
        fileId,
        bucket,
        objectKey,
        originalFileName: fileName,
        status: "PROCESSED",
        uploadedAt,
        processedAt: new Date().toISOString(),
        source: "S3_EVENT",
        labels,
      };

      await docClient.send(
        new PutCommand({
          TableName: process.env.METADATA_TABLE_NAME!,
          Item: item,
        })
      );

      console.log("Metadata record written:", JSON.stringify(item, null, 2));

      await notifyConnectedClients(item);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Media metadata stored" }),
  };
};

async function notifyConnectedClients(item: Record<string, unknown>) {
  if (!process.env.CONNECTIONS_TABLE_NAME || !process.env.WEBSOCKET_API_ENDPOINT) {
    console.log("WebSocket notification skipped: missing environment variables.");
    return;
  }

  const connections = await docClient.send(
    new ScanCommand({
      TableName: process.env.CONNECTIONS_TABLE_NAME,
    })
  );

  const message = JSON.stringify({
    type: "MEDIA_PROCESSED",
    payload: item,
  });

  for (const connection of connections.Items || []) {
    const connectionId = connection.connectionId as string | undefined;

    if (!connectionId) continue;

    try {
      await apiGatewayClient.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(message),
        })
      );

      console.log(`Sent WebSocket notification to ${connectionId}`);
    } catch (error) {
      console.error(`Failed to send WebSocket notification to ${connectionId}`, error);
    }
  }
}
