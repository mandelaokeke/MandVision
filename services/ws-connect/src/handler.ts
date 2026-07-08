

import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

declare const process: {
  env: {
    CONNECTIONS_TABLE_NAME?: string;
  };
};

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const main = async (event: any) => {
  const connectionId = event.requestContext.connectionId;

  try {
    await docClient.send(
      new PutCommand({
        TableName: process.env.CONNECTIONS_TABLE_NAME!,
        Item: {
          connectionId,
          connectedAt: new Date().toISOString(),
        },
      })
    );

    console.log(`WebSocket connected: ${connectionId}`);

    return {
      statusCode: 200,
      body: "Connected.",
    };
  } catch (error) {
    console.error("Failed to store WebSocket connection", error);

    return {
      statusCode: 500,
      body: "Connection failed.",
    };
  }
};