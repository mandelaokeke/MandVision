const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");
const s3 = new S3Client({});
exports.main = async (event) => {
 try {
 const body = JSON.parse(event.body || "{}");
const fileName = body.fileName;

    const fileType = body.fileType || "application/octet-stream";

    if (!fileName) {

      return {

        statusCode: 400,

        headers: corsHeaders(),

        body: JSON.stringify({ message: "fileName is required" }),

      };

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

    return {

      statusCode: 200,

      headers: corsHeaders(),

      body: JSON.stringify({

        uploadUrl,

        key,

        fileId,

        expiresIn: 300,

      }),

    };

  } catch (error) {

    console.error("Presign error:", error);

    return {

      statusCode: 500,

      headers: corsHeaders(),

      body: JSON.stringify({ message: "Could not generate upload URL" }),

    };

  }

};

function corsHeaders() {

  return {

    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Headers": "*",

    "Access-Control-Allow-Methods": "OPTIONS,POST",

  };

}

