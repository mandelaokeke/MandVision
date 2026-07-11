import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

declare const process: {
  env: {
    INGEST_BUCKET_NAME?: string;
    METADATA_TABLE_NAME?: string;
  };
};

const s3 = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const guestUploadLimit = 5;

export const main = async (event: any) => {

  try {

    const body = JSON.parse(event.body || "{}");

    const fileName = body.fileName;

    const fileType = body.fileType || "application/octet-stream";
    const ownerUserId =
      typeof body.ownerUserId === "string" ? body.ownerUserId.trim() : "";
    const guestSessionId =
      typeof body.guestSessionId === "string" ? body.guestSessionId.trim() : "";

    if (!fileName) {

      return response(400, { message: "fileName is required" });

    }

    if (!ownerUserId && guestSessionId) {
      const guestUploadCount = await countGuestUploads(guestSessionId);

      if (guestUploadCount >= guestUploadLimit) {
        return response(403, {
          message: "Guest demo limit reached. Sign in to keep uploading and save your workspace.",
          limit: guestUploadLimit,
        });
      }
    }

    const fileId = crypto.randomUUID();

    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

    const key = `uploads/${fileId}-${safeFileName}`;
    const metadata: Record<string, string> = Object.fromEntries(
      Object.entries({
        owneruserid: ownerUserId || undefined,
        guestsessionid: guestSessionId || undefined,
      }).filter(([, value]) => value)
    );
    const uploadHeaders: Record<string, string> = {
      "Content-Type": fileType,
    };

    const command = new PutObjectCommand({

      Bucket: process.env.INGEST_BUCKET_NAME,

      Key: key,

      ContentType: fileType,

      Metadata: metadata,

    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    return response(200, {

      uploadUrl,

      key,

      fileId,

      expiresIn: 300,

      uploadHeaders,

    });

  } catch (error) {

    console.error("Presign error:", error);

    return response(500, { message: "Could not generate upload URL" });

  }

};

async function countGuestUploads(guestSessionId: string) {
  if (!process.env.METADATA_TABLE_NAME) return 0;

  const result = await docClient.send(
    new ScanCommand({
      TableName: process.env.METADATA_TABLE_NAME,
      FilterExpression: "#guestSessionId = :guestSessionId",
      ExpressionAttributeNames: {
        "#guestSessionId": "guestSessionId",
      },
      ExpressionAttributeValues: {
        ":guestSessionId": guestSessionId,
      },
      Select: "COUNT",
      Limit: guestUploadLimit,
    })
  );

  return result.Count || 0;
}

function response(statusCode: number, body: object) {

  return {

    statusCode,

    headers: {

      "Access-Control-Allow-Origin": "*",

      "Access-Control-Allow-Headers": "*",

      "Access-Control-Allow-Methods": "OPTIONS,POST",

    },

    body: JSON.stringify(body),

  };

}
