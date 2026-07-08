

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

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
      new DeleteCommand({
        TableName: process.env.CONNECTIONS_TABLE_NAME!,
        Key: {
          connectionId,
        },
      })
    );

    console.log(`WebSocket disconnected: ${connectionId}`);

    return {
      statusCode: 200,
      body: "Disconnected.",
    };
  } catch (error) {
    console.error("Failed to remove WebSocket connection", error);

    return {
      statusCode: 500,
      body: "Disconnect failed.",
    };
  }
};