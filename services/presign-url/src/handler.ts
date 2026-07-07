import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
const s3 = new S3Client({});
export const main = async (event: any) => {

  try {

    const body = JSON.parse(event.body || "{}");

    const fileName = body.fileName;

    const fileType = body.fileType || "application/octet-stream";

    if (!fileName) {

      return response(400, { message: "fileName is required" });

    }

    const fileId = crypto.randomUUID();

    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

    const key = `uploads/${fileId}-${safeFileName}`;

    const command = new PutObjectCommand({

      Bucket: process.env.INGEST_BUCKET_NAME,

      Key: key,

      ContentType: fileType,

    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    return response(200, {

      uploadUrl,

      key,

      fileId,

      expiresIn: 300,

    });

  } catch (error) {

    console.error("Presign error:", error);

    return response(500, { message: "Could not generate upload URL" });

  }

};

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

