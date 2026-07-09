import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

declare const process: {
  env: {
    METADATA_TABLE_NAME?: string;
  };
};

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "OPTIONS,GET,DELETE",
};

export const main = async (event: any) => {
  try {
    const fileId = event.pathParameters?.fileId;

    if (!fileId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "fileId is required" }),
      };
    }

    const result = await docClient.send(
      new GetCommand({
        TableName: process.env.METADATA_TABLE_NAME!,
        Key: { fileId },
      })
    );

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Media item not found" }),
      };
    }

    const bucket = result.Item.bucket as string | undefined;
    const objectKey = result.Item.objectKey as string | undefined;

    if (bucket && objectKey) {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        })
      );
    }

    await docClient.send(
      new DeleteCommand({
        TableName: process.env.METADATA_TABLE_NAME!,
        Key: { fileId },
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        fileId,
        bucket,
        objectKey,
        deleted: true,
      }),
    };
  } catch (error) {
    console.error("Delete media error:", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Could not delete media item" }),
    };
  }
};
