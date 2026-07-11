import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

declare const process: {
  env: {
    METADATA_TABLE_NAME?: string;
    OPENAI_API_KEY?: string;
    OPENAI_API_KEY_SECRET_NAME?: string;
    OPENAI_MODEL?: string;
  };
};

type ImageLabel = {
  name?: string;
  confidence?: number;
};

type MediaItem = {
  fileId: string;
  originalFileName?: string;
  mediaType?: string;
  status?: string;
  bucket?: string;
  objectKey?: string;
  labels?: ImageLabel[];
};

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});
const secretsClient = new SecretsManagerClient({});
let cachedOpenAIKey: string | null | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "OPTIONS,POST",
};

export const main = async (event: any) => {
  if (event.httpMethod === "OPTIONS") {
    return response(204, {});
  }

  try {
    const body = JSON.parse(event.body || "{}") as {
      question?: string;
      fileId?: string;
    };
    const question = body.question?.trim();
    const fileId = body.fileId?.trim();

    if (!question) {
      return response(400, { message: "question is required" });
    }

    if (!fileId) {
      return response(400, { message: "fileId is required" });
    }

    const image = await getImage(fileId);

    if (!image) {
      return response(404, { message: "Image item not found" });
    }

    if (!image.bucket || !image.objectKey) {
      return response(400, { message: "Image is missing storage details" });
    }

    const openAIKey = await getOpenAIKey();

    if (!openAIKey) {
      return response(200, {
        answer:
          "**I can see the saved image labels, but the LLM is not connected yet.**\n\nThe OpenAI key was not available to MandVision, so I can only show the current detection labels for now.",
        mode: "fallback",
        aiError: "OpenAI API key is unavailable.",
        labels: image.labels || [],
      });
    }

    const previewUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: image.bucket,
        Key: image.objectKey,
      }),
      { expiresIn: 600 }
    );

    const aiResult = await askOpenAI(question, image, previewUrl, openAIKey);

    return response(200, {
      answer:
        aiResult.answer ||
        "**I could not get a full vision answer right now.**\n\nTry again in a moment, or ask about one of the detected labels.",
      mode: aiResult.answer ? "vision" : "fallback",
      aiError: aiResult.error,
      labels: image.labels || [],
    });
  } catch (error) {
    console.error("Ask vision error:", error);

    return response(500, { message: "Could not answer vision question" });
  }
};

async function getImage(fileId: string) {
  const result = await docClient.send(
    new GetCommand({
      TableName: process.env.METADATA_TABLE_NAME!,
      Key: { fileId },
    })
  );
  const item = result.Item as MediaItem | undefined;

  return item?.mediaType === "image" ? item : null;
}

async function askOpenAI(question: string, image: MediaItem, imageUrl: string, openAIKey: string) {
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6",
        input: [
          {
            role: "system",
            content:
              "You are VisoAI, MandVision's friendly vision assistant. Answer naturally and conversationally in markdown. Use the selected image as the primary source, and use MandVision's detected labels only as supporting context. Be direct with simple questions. If the user asks whether something is present, answer yes/no with brief visual reasoning and confidence language. If you are uncertain, say what you can and cannot tell. Do not claim forensic certainty, medical certainty, or identity certainty. If asked to identify a person, do not name them; describe visible non-sensitive features instead.",
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  `User question: ${question}`,
                  `Selected file: ${image.originalFileName || image.fileId}`,
                  `MandVision labels: ${formatLabels(image.labels) || "No labels available"}`,
                ].join("\n"),
              },
              {
                type: "input_image",
                image_url: imageUrl,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("OpenAI vision ask failed", response.status, await response.text());

      return {
        error: "AI vision is unavailable right now, so MandVision could not generate a full answer.",
      };
    }

    const data = (await response.json()) as any;

    return {
      answer: extractOpenAIText(data),
    };
  } catch (error) {
    console.error("OpenAI vision ask request failed", error);

    return {
      error: "AI vision is unavailable right now, so MandVision could not generate a full answer.",
    };
  }
}

function formatLabels(labels?: ImageLabel[]) {
  return (labels || [])
    .filter((label) => label.name)
    .sort((first, second) => (second.confidence || 0) - (first.confidence || 0))
    .slice(0, 20)
    .map((label) => `${label.name}${label.confidence ? ` (${Math.round(label.confidence)}%)` : ""}`)
    .join(", ");
}

async function getOpenAIKey() {
  if (cachedOpenAIKey !== undefined) return cachedOpenAIKey;

  if (process.env.OPENAI_API_KEY) {
    cachedOpenAIKey = process.env.OPENAI_API_KEY;
    return cachedOpenAIKey;
  }

  if (!process.env.OPENAI_API_KEY_SECRET_NAME) {
    cachedOpenAIKey = null;
    return cachedOpenAIKey;
  }

  try {
    const result = await secretsClient.send(
      new GetSecretValueCommand({
        SecretId: process.env.OPENAI_API_KEY_SECRET_NAME,
      })
    );
    const secret = result.SecretString || "";
    cachedOpenAIKey = parseOpenAIKeySecret(secret);
  } catch (error) {
    console.warn("OpenAI secret is not available; using fallback answer mode.");
    cachedOpenAIKey = null;
  }

  return cachedOpenAIKey;
}

function parseOpenAIKeySecret(secret: string) {
  if (!secret.trim()) return null;

  try {
    const parsed = JSON.parse(secret) as Record<string, string | undefined>;

    return (
      parsed.OPENAI_API_KEY ||
      parsed.openai_api_key ||
      parsed.apiKey ||
      parsed.api_key ||
      parsed["mandvision/openai-api-key"] ||
      parsed.key ||
      null
    );
  } catch {
    return secret;
  }
}

function extractOpenAIText(data: any) {
  if (typeof data.output_text === "string") return data.output_text.trim();

  const output = Array.isArray(data.output) ? data.output : [];
  const parts = output.flatMap((item: any) => (Array.isArray(item.content) ? item.content : []));
  const text = parts
    .map((part: any) => part.text || part.output_text || "")
    .filter(Boolean)
    .join("\n")
    .trim();

  return text;
}

function response(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}
