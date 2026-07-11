import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

declare const process: {
  env: {
    METADATA_TABLE_NAME?: string;
    OPENAI_API_KEY?: string;
    OPENAI_API_KEY_SECRET_NAME?: string;
    OPENAI_MODEL?: string;
  };
};

type DocumentInsights = {
  emails?: string[];
  phoneNumbers?: string[];
  dates?: string[];
  amounts?: string[];
  identifiers?: string[];
};

type MediaItem = {
  fileId: string;
  originalFileName?: string;
  mediaType?: string;
  status?: string;
  extractedText?: string;
  textPreview?: string;
  wordCount?: number;
  documentInsights?: DocumentInsights;
};

type AnswerMatch = {
  fileId: string;
  originalFileName?: string;
  score: number;
  snippets: string[];
  wordCount?: number;
};

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const secretsClient = new SecretsManagerClient({});
const maxContextCharacters = 10000;
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
      fileIds?: string[];
    };
    const question = body.question?.trim();

    if (!question) {
      return response(400, { message: "question is required" });
    }

    const documents = body.fileIds?.length
      ? await getDocumentsByIds(body.fileIds)
      : body.fileId
      ? await getSingleDocument(body.fileId)
      : [];

    if (!documents.length) {
      return response(200, {
        answer: "I could not find any searchable documents yet.",
        mode: "fallback",
        matches: [],
      });
    }

    const localAnswer = buildLocalAnswer(question, documents);

    const openAIKey = await getOpenAIKey();

    if (!openAIKey) {
      return response(200, {
        ...localAnswer,
        mode: "fallback",
      });
    }

    const aiResult = await askOpenAI(question, localAnswer.matches, documents, openAIKey);

    return response(200, {
      answer: aiResult.answer || localAnswer.answer,
      mode: aiResult.answer ? "ai" : "fallback",
      aiError: aiResult.error,
      matches: localAnswer.matches,
    });
  } catch (error) {
    console.error("Ask document error:", error);

    return response(500, { message: "Could not answer document question" });
  }
};

async function getDocumentsByIds(fileIds: string[]) {
  const uniqueFileIds = Array.from(
    new Set(fileIds.filter((fileId) => typeof fileId === "string" && fileId.trim()).slice(0, 25))
  );
  const results = await Promise.all(uniqueFileIds.map((fileId) => getSingleDocument(fileId)));

  return results.flat();
}

async function getSingleDocument(fileId: string) {
  const result = await docClient.send(
    new GetCommand({
      TableName: process.env.METADATA_TABLE_NAME!,
      Key: { fileId },
    })
  );
  const item = result.Item as MediaItem | undefined;

  return item && isSearchableDocument(item) ? [item] : [];
}

function isSearchableDocument(item: MediaItem) {
  return item.mediaType === "document" && Boolean(getExtractedText(item) || getInsightValues(item).length);
}

function buildLocalAnswer(question: string, documents: MediaItem[]) {
  const intent = getQuestionIntent(question);
  const terms = getSearchTerms(question);
  const matches = documents
    .map((item) => scoreDocument(item, terms, intent))
    .filter((match) => match.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, 6);

  return {
    answer: summarizeAnswer(question, matches, intent, documents.length),
    matches,
  };
}

function scoreDocument(
  item: MediaItem,
  terms: string[],
  intent: ReturnType<typeof getQuestionIntent>
): AnswerMatch {
  const text = getExtractedText(item);
  const insights = getInsightValues(item);
  const searchable = [item.originalFileName || "", text, ...insights].join(" ").toLowerCase();
  const snippets: string[] = [];
  let score = 0;

  for (const term of terms) {
    if (searchable.includes(term)) {
      score += term.length > 3 ? 3 : 1;
      const snippet = findSnippet(text, term);
      if (snippet) snippets.push(snippet);
    }
  }

  const intentValues = getIntentValues(item, intent);
  if (intentValues.length > 0) {
    score += 8;
    snippets.unshift(...intentValues.slice(0, 3));
  }

  if (!snippets.length && score > 0) {
    snippets.push(item.textPreview || text.slice(0, 180));
  }

  return {
    fileId: item.fileId,
    originalFileName: item.originalFileName,
    wordCount: item.wordCount,
    score,
    snippets: Array.from(new Set(snippets.filter(Boolean))).slice(0, 3),
  };
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

async function askOpenAI(
  question: string,
  matches: AnswerMatch[],
  documents: MediaItem[],
  openAIKey: string
) {
  const context = buildContext(matches, documents);

  if (!context) return {};

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
              "You are VisoAI, MandVision's friendly chat assistant. Be conversational, concise, and helpful. For questions about uploaded documents, use only the provided MandVision document context and mention source filenames when useful. You may compare, summarize, and extract details across the provided documents. If a requested document detail is not present, say you could not find it and ask how else you can help.",
          },
          {
            role: "user",
            content: `Question: ${question}\n\nDocument context:\n${context}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("OpenAI ask failed", response.status, await response.text());
      return {
        error: "AI is unavailable right now, so MandVision is showing a smart search answer.",
      };
    }

    const data = (await response.json()) as any;
    return {
      answer: extractOpenAIText(data),
    };
  } catch (error) {
    console.error("OpenAI ask request failed", error);
    return {
      error: "AI is unavailable right now, so MandVision is showing a smart search answer.",
    };
  }
}

function buildContext(matches: AnswerMatch[], documents: MediaItem[]) {
  const matchedIds = new Set(matches.map((match) => match.fileId));
  const relevantDocuments = documents
    .filter((item) => matchedIds.has(item.fileId))
    .slice(0, 4);
  const sourceDocuments = relevantDocuments.length ? relevantDocuments : documents.slice(0, 4);

  return sourceDocuments
    .map((item) => {
      const insights = getInsightValues(item).join("; ");
      const text = getExtractedText(item).slice(0, 2500);

      return [
        `File: ${item.originalFileName || item.fileId}`,
        insights ? `Detected details: ${insights}` : "",
        `Text: ${text}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n")
    .slice(0, maxContextCharacters);
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

function getQuestionIntent(question: string) {
  const normalized = question.toLowerCase();

  return {
    wantsAmounts: /\b(total|amount|price|cost|due|paid|invoice total|dollar|usd)\b/.test(normalized),
    wantsEmails: /\b(email|contact|sender|recipient)\b/.test(normalized),
    wantsPhones: /\b(phone|telephone|call|number)\b/.test(normalized),
    wantsDates: /\b(date|when|due date|deadline|july|jan|feb|mar|apr|may|jun|aug|sep|oct|nov|dec)\b/.test(normalized),
    wantsIdentifiers: /\b(invoice|receipt|order|reference|account|id|identifier)\b/.test(normalized),
    wantsSummary: /\b(summary|summarize|overview|explain)\b/.test(normalized),
  };
}

function getIntentValues(item: MediaItem, intent: ReturnType<typeof getQuestionIntent>) {
  const insights = item.documentInsights;
  if (!insights) return [];

  const values = [
    ...(intent.wantsAmounts ? insights.amounts || [] : []),
    ...(intent.wantsEmails ? insights.emails || [] : []),
    ...(intent.wantsPhones ? insights.phoneNumbers || [] : []),
    ...(intent.wantsDates ? insights.dates || [] : []),
    ...(intent.wantsIdentifiers ? insights.identifiers || [] : []),
  ].map((value) => `${value} found in ${item.originalFileName || "document"}`);

  if (intent.wantsSummary) {
    const text = getExtractedText(item);
    values.unshift(item.textPreview || text.slice(0, 220));
  }

  return values;
}

function summarizeAnswer(
  question: string,
  matches: AnswerMatch[],
  intent: ReturnType<typeof getQuestionIntent>,
  documentCount: number
) {
  if (!matches.length) {
    return `I searched ${documentCount} document${documentCount === 1 ? "" : "s"} but could not find a match for "${question}".`;
  }

  const topValues = matches.flatMap((match) => {
    const item = {
      fileId: match.fileId,
      originalFileName: match.originalFileName,
    } as MediaItem;
    return match.snippets.length ? match.snippets : getIntentValues(item, intent);
  }).slice(0, 4);

  if (topValues.length > 0) {
    return `I found ${matches.length} matching document${matches.length === 1 ? "" : "s"}. ${topValues.join(" ")}`;
  }

  return `I found ${matches.length} document${matches.length === 1 ? "" : "s"} that match "${question}".`;
}

function getSearchTerms(question: string) {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9@.$/-]+/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !stopWords.has(term));
}

function findSnippet(text: string, term: string) {
  if (!text || !term) return "";

  const normalizedText = text.toLowerCase();
  const index = normalizedText.indexOf(term);
  if (index === -1) return "";

  const start = Math.max(index - 70, 0);
  const end = Math.min(index + term.length + 110, text.length);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";

  return `${prefix}${text.slice(start, end)}${suffix}`;
}

function getExtractedText(item: MediaItem) {
  return item.extractedText || item.textPreview || "";
}

function getInsightValues(item: MediaItem) {
  const insights = item.documentInsights;
  if (!insights) return [];

  return [
    ...(insights.emails || []),
    ...(insights.phoneNumbers || []),
    ...(insights.dates || []),
    ...(insights.amounts || []),
    ...(insights.identifiers || []),
  ];
}

function response(statusCode: number, body: object) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

const stopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "what",
  "which",
  "show",
  "find",
  "documents",
  "document",
  "uploads",
  "upload",
  "does",
  "have",
  "from",
  "into",
]);
