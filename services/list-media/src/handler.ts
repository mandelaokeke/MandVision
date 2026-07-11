

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

declare const process: {
  env: {
    METADATA_TABLE_NAME?: string;
  };
};

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "OPTIONS,GET",
};

export const main = async (event: any) => {
  try {
    const ownerUserId = event.queryStringParameters?.ownerUserId?.trim();
    const guestSessionId = event.queryStringParameters?.guestSessionId?.trim();

    if (!ownerUserId && !guestSessionId) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ items: [] }),
      };
    }

    const result = await docClient.send(
      new ScanCommand({
        TableName: process.env.METADATA_TABLE_NAME!,
        FilterExpression: ownerUserId ? "#ownerUserId = :ownerUserId" : "#guestSessionId = :guestSessionId",
        ExpressionAttributeNames: ownerUserId
          ? { "#ownerUserId": "ownerUserId" }
          : { "#guestSessionId": "guestSessionId" },
        ExpressionAttributeValues: ownerUserId
          ? { ":ownerUserId": ownerUserId }
          : { ":guestSessionId": guestSessionId },
        Limit: 50,
      })
    );

    const items = (result.Items || []).sort((a, b) => {
      const aTime = new Date((a.processedAt || a.uploadedAt || 0) as string).getTime();
      const bTime = new Date((b.processedAt || b.uploadedAt || 0) as string).getTime();
      return bTime - aTime;
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ items }),
    };
  } catch (error) {
    console.error("List media error:", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Could not list media items" }),
    };
  }
};
