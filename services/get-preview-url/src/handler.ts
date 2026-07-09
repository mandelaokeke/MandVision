import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
  "Access-Control-Allow-Methods": "OPTIONS,GET",
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

    if (!bucket || !objectKey) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Media item is missing bucket or objectKey" }),
      };
    }

    const previewUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      }),
      { expiresIn: 300 }
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        fileId,
        bucket,
        objectKey,
        previewUrl,
        expiresIn: 300,
      }),
    };
  } catch (error) {
    console.error("Get preview URL error:", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Could not generate preview URL" }),
    };
  }
};
