"use client";

import { AlertTriangle, Bot, FileSearch, Search, Send, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { MediaResult } from "@/hooks/useUpload";
import { getExtractedText } from "@/lib/export";

type AnswerMatch = {
  item: MediaResult;
  score: number;
  snippets: string[];
};

type AssistantAnswer = {
  question: string;
  summary: string;
  mode?: string;
  aiError?: string;
  matches: AnswerMatch[];
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  answer?: AssistantAnswer;
};

const quickQuestions = [
  "How are you?",
  "What can VisoAI help with?",
  "Compare two documents",
  "Which documents mention an email?",
];

export function DocumentAssistantCard({
  items,
  selectedItem,
  onSelectItem,
  onFilterTermChange,
}: {
  items: MediaResult[];
  selectedItem?: MediaResult | null;
  onSelectItem: (item: MediaResult) => void;
  onFilterTermChange: (term: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [searchSelectedOnly, setSearchSelectedOnly] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi, I’m VisoAI. I can chat with you, explain how MandVision works, and answer questions about your processed documents. How can I help you today?",
      answer: {
        question: "welcome",
        summary:
          "Hi, I’m VisoAI. I can chat with you, explain how MandVision works, and answer questions about your processed documents. How can I help you today?",
        mode: "chat",
        matches: [],
      },
    },
  ]);
  const [askingBackend, setAskingBackend] = useState(false);
  const documents = useMemo(
    () =>
      items.filter(
        (item) =>
          item.mediaType === "document" &&
          (getExtractedText(item) || getInsightValues(item).length > 0)
      ),
    [items]
  );
  const selectedDocument =
    selectedItem?.mediaType === "document" &&
    (getExtractedText(selectedItem) || getInsightValues(selectedItem).length > 0)
      ? selectedItem
      : null;
  const searchableDocuments = useMemo(
    () => (searchSelectedOnly && selectedDocument ? [selectedDocument] : documents),
    [documents, searchSelectedOnly, selectedDocument]
  );
  const suggestedQuestions = useMemo(
    () => buildSuggestedQuestions(selectedDocument),
    [selectedDocument]
  );
  const promptSuggestions = useMemo(
    () => Array.from(new Set([...suggestedQuestions, ...quickQuestions])).slice(0, 6),
    [suggestedQuestions]
  );

  function askQuestion(nextQuestion = question) {
    const cleanQuestion = nextQuestion.trim();
    if (!cleanQuestion) return;

    setQuestion("");
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: cleanQuestion,
      },
    ]);

    const instantAnswer = buildConversationalAnswer(cleanQuestion);
    if (instantAnswer) {
      addAssistantMessage(instantAnswer);
      return;
    }

    void askBackend(cleanQuestion, searchableDocuments);
  }

  function summarizeSelectedDocument() {
    if (!selectedDocument) return;

    const cleanQuestion = `Summarize ${selectedDocument.originalFileName || "this document"}`;
    setSearchSelectedOnly(true);
    setQuestion("");
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: cleanQuestion,
      },
    ]);
    void askBackend(cleanQuestion, [selectedDocument]);
  }

  function addAssistantMessage(answer: AssistantAnswer) {
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: answer.summary,
        answer,
      },
    ]);
  }

  async function askBackend(nextQuestion: string, scopedDocuments: MediaResult[]) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        addAssistantMessage(buildAnswer(nextQuestion, scopedDocuments, true));
        return;
      }

      setAskingBackend(true);

      const response = await fetch(`${apiUrl}/documents/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: nextQuestion,
          fileIds: scopedDocuments.map((item) => item.fileId),
        }),
      });

      if (!response.ok) {
        addAssistantMessage({
          ...buildAnswer(nextQuestion, scopedDocuments, true),
          aiError: "AI is unavailable right now, so I’m showing a smart document-search answer.",
        });
        return;
      }

      const data = (await response.json()) as {
        answer?: string;
        mode?: string;
        aiError?: string;
        matches?: {
          fileId: string;
          score?: number;
          snippets?: string[];
        }[];
      };
      const documentById = new Map(scopedDocuments.map((item) => [item.fileId, item]));
      const matches =
        data.matches
          ?.map((match) => {
            const item = documentById.get(match.fileId);
            if (!item) return null;

            return {
              item,
              score: match.score || 0,
              snippets: match.snippets || [],
            };
          })
          .filter((match): match is AnswerMatch => Boolean(match)) || [];

      addAssistantMessage({
        question: nextQuestion,
        summary: data.answer || buildAnswer(nextQuestion, scopedDocuments).summary,
        mode: data.mode,
        aiError: data.aiError,
        matches,
      });
    } catch (error) {
      console.error("Could not ask document endpoint", error);
      addAssistantMessage({
        ...buildAnswer(nextQuestion, scopedDocuments, true),
        aiError: "AI is unavailable right now, so I’m showing a smart document-search answer.",
      });
    } finally {
      setAskingBackend(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-6 pt-6">
      <div className="rounded-2xl border border-white/10 bg-[#0d131c] p-6 text-white shadow-2xl shadow-black/20">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-300/30 bg-sky-300/10 text-sky-200">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-200/80">
                Assistant
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">VisoAI</h2>
              <p className="mt-1 text-sm text-slate-400">
                Chat naturally, ask about MandVision, or compare and search processed documents.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
            {searchableDocuments.length} searchable document{searchableDocuments.length === 1 ? "" : "s"}
          </div>
        </div>

        <form
          className="flex flex-col gap-3 md:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            askQuestion();
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Message VisoAI..."
              className="h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 pl-9 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
            />
          </div>
          <button
            type="submit"
            disabled={!question.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-sky-300/30 bg-sky-300/10 px-4 text-sm font-medium text-sky-200 transition hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            {askingBackend ? "Thinking..." : "Send"}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {selectedDocument ? (
            <>
              <button
                type="button"
                onClick={summarizeSelectedDocument}
                disabled={askingBackend}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Summarize this document
              </button>
              <label className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={searchSelectedOnly}
                  onChange={(event) => setSearchSelectedOnly(event.target.checked)}
                  className="h-3.5 w-3.5 accent-sky-300"
                />
                Search selected document only
              </label>
            </>
          ) : null}
          {promptSuggestions.map((quickQuestion) => (
            <button
              key={quickQuestion}
              type="button"
              onClick={() => askQuestion(quickQuestion)}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-sky-300/40 hover:bg-sky-300/10 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {quickQuestion}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <div className="ai-chat-scroll max-h-[540px] space-y-4 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-4">
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                onSelectItem={(item) => {
                  onSelectItem(item);
                  onFilterTermChange(item.originalFileName || item.fileId);
                }}
              />
            ))}
            {askingBackend ? (
              <div className="ai-assistant-row flex items-start gap-3">
                <div className="ai-assistant-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-300/30 bg-sky-300/10 text-sky-100">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="ai-assistant-bubble max-w-[82%] rounded-2xl rounded-tl-md border border-sky-300/20 bg-[#0d1722] p-4 text-sm text-slate-100">
                  <div className="mb-2 text-xs font-medium text-sky-200">VisoAI</div>
                  Reading your processed documents...
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatBubble({
  message,
  onSelectItem,
}: {
  message: ChatMessage;
  onSelectItem: (item: MediaResult) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="ai-user-bubble max-w-[82%] rounded-2xl rounded-tr-md bg-emerald-400/15 px-4 py-3 text-sm text-emerald-50">
          {message.text}
        </div>
      </div>
    );
  }

  const answer = message.answer;

  return (
    <div className="ai-assistant-row flex items-start gap-3">
      <div className="ai-assistant-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-300/30 bg-sky-300/10 text-sky-100">
        <Bot className="h-4 w-4" />
      </div>
      <div className="ai-assistant-bubble max-w-[88%] rounded-2xl rounded-tl-md border border-sky-300/20 bg-[#0d1722] p-4 text-sm text-slate-100">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="ai-assistant-name text-xs font-semibold text-sky-200">VisoAI</span>
          {answer?.mode === "ai" ? (
            <span className="ai-answer-badge inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[11px] font-medium text-emerald-100">
              <Sparkles className="h-3 w-3" />
              Document answer
            </span>
          ) : answer?.mode === "fallback" ? (
            <span className="ai-answer-badge inline-flex items-center gap-1.5 rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-0.5 text-[11px] font-medium text-sky-100">
              <FileSearch className="h-3 w-3" />
              Smart search
            </span>
          ) : null}
        </div>
        <div className="leading-6">{message.text}</div>
        {answer?.aiError ? (
          <div className="mt-3 flex gap-2 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{answer.aiError}</span>
          </div>
        ) : null}
        {answer?.matches.length ? (
          <div className="ai-source-panel mt-4 border-t border-white/10 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
              Source snippets
            </p>
            <div className="space-y-2">
              {answer.matches.slice(0, 3).map((match) => (
                <button
                  key={`source-${message.id}-${match.item.fileId}`}
                  type="button"
                  onClick={() => onSelectItem(match.item)}
                  className="ai-source-card w-full rounded-lg bg-black/20 p-3 text-left transition hover:bg-sky-300/10"
                >
                  <p className="mb-1 truncate text-xs font-medium text-white/80">
                    {match.item.originalFileName || match.item.fileId}
                  </p>
                  <p className="line-clamp-2 text-xs leading-5 text-white/65">
                    {match.snippets[0] || match.item.textPreview || "Source document matched this question."}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function buildConversationalAnswer(question: string): AssistantAnswer | null {
  const normalized = question.toLowerCase();
  const makeAnswer = (summary: string, mode = "chat"): AssistantAnswer => ({
    question,
    summary,
    mode,
    matches: [],
  });

  if (/\b(hi|hello|hey|how are you|how's it going|good morning|good afternoon|good evening)\b/.test(normalized)) {
    return makeAnswer(
      "I’m doing well, thank you. I’m here to help with MandVision, your uploads, or questions about processed documents. How can I help you today?"
    );
  }

  if (/\b(thanks|thank you|appreciate)\b/.test(normalized)) {
    return makeAnswer(
      "You’re welcome. I can help you find details in documents, compare uploads, summarize files, or explain how MandVision works. What would you like to do next?"
    );
  }

  return buildAppAnswer(question);
}

function buildSuggestedQuestions(selectedDocument: MediaResult | null) {
  if (!selectedDocument) return [];

  const questions = new Set<string>();
  const insights = selectedDocument.documentInsights;
  const fileName = selectedDocument.originalFileName || "this document";

  if (insights?.amounts?.length) questions.add(`What amounts are in ${fileName}?`);
  if (insights?.dates?.length) questions.add(`What dates are in ${fileName}?`);
  if (insights?.emails?.length) questions.add(`What emails are in ${fileName}?`);
  if (insights?.phoneNumbers?.length) questions.add(`What phone numbers are in ${fileName}?`);
  if (insights?.identifiers?.length) questions.add(`What invoice or reference IDs are in ${fileName}?`);

  questions.add(`Summarize ${fileName}`);

  return Array.from(questions).slice(0, 3);
}

function buildAnswer(
  question: string,
  documents: MediaResult[],
  friendlyFallback = false
): AssistantAnswer {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) {
    return {
      question: cleanQuestion,
      summary: "",
      matches: [] as AnswerMatch[],
    };
  }

  const intent = getQuestionIntent(cleanQuestion);
  const terms = getSearchTerms(cleanQuestion);
  const matches = documents
    .map((item) => scoreDocument(item, terms, intent))
    .filter((match) => match.score > 0)
    .sort((first, second) => second.score - first.score);

  return {
    question: cleanQuestion,
    summary: summarizeAnswer(cleanQuestion, matches, intent, friendlyFallback, documents.length),
    matches,
  };
}

function buildAppAnswer(question: string): AssistantAnswer | null {
  const normalized = question.toLowerCase();
  const makeAnswer = (summary: string): AssistantAnswer => ({
    question,
    summary,
    mode: "app",
    matches: [],
  });

  if (/\b(visoai|ai|assistant|ask|question|summary|summarize|source|snippet)\b/.test(normalized)) {
    return makeAnswer(
      "VisoAI answers questions about MandVision and your processed documents. You can ask for summaries, emails, dates, IDs, invoice details, or where a detail appears in an uploaded PDF or Word document."
    );
  }

  if (/\b(upload|file|image|pdf|doc|docx|process|processing)\b/.test(normalized)) {
    return makeAnswer(
      "Use Upload to add JPG, PNG, PDF, DOC, or DOCX files. MandVision stores the file, processes it, then adds searchable results to your Library once processing is complete."
    );
  }

  if (/\b(library|manage|delete|favorite|filter|export|history|download|preview)\b/.test(normalized)) {
    return makeAnswer(
      "Use Library to manage processed uploads. From there you can preview files, filter results, mark favorites, export CSV data, download originals, and delete uploads you no longer need."
    );
  }

  if (/\b(sign|login|log in|account|password|auth|cognito|user)\b/.test(normalized)) {
    return makeAnswer(
      "Create an account or sign in from the dashboard. When signed in, MandVision can show your own uploads and account actions, including password recovery and account deletion."
    );
  }

  if (/\b(app|mandvision|help|how do i|what can|where do i)\b/.test(normalized)) {
    return makeAnswer(
      "MandVision has four main areas: Dashboard for analytics, Upload for adding files, Library for managing processed media, and VisoAI for asking questions about the app or your processed documents."
    );
  }

  return null;
}

function scoreDocument(
  item: MediaResult,
  terms: string[],
  intent: ReturnType<typeof getQuestionIntent>
): AnswerMatch {
  const text = getExtractedText(item);
  const insights = getInsightValues(item);
  const searchable = [
    item.originalFileName || "",
    text,
    ...insights,
  ].join(" ").toLowerCase();
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
    item,
    score,
    snippets: Array.from(new Set(snippets.filter(Boolean))).slice(0, 3),
  };
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

function getIntentValues(item: MediaResult, intent: ReturnType<typeof getQuestionIntent>) {
  const insights = item.documentInsights;
  if (!insights) return [];

  const values = [
    ...(intent.wantsAmounts ? insights.amounts || [] : []),
    ...(intent.wantsEmails ? insights.emails || [] : []),
    ...(intent.wantsPhones ? insights.phoneNumbers || [] : []),
    ...(intent.wantsDates ? insights.dates || [] : []),
    ...(intent.wantsIdentifiers ? insights.identifiers || [] : []),
  ];

  const mappedValues = values.map((value) => `${value} found in ${item.originalFileName || "document"}`);
  if (intent.wantsSummary) {
    const text = getExtractedText(item);
    mappedValues.unshift(item.textPreview || text.slice(0, 220));
  }

  return mappedValues;
}

function summarizeAnswer(
  question: string,
  matches: AnswerMatch[],
  intent: ReturnType<typeof getQuestionIntent>,
  friendlyFallback = false,
  documentCount = 0
) {
  if (!matches.length) {
    if (friendlyFallback) {
      return documentCount
        ? `I did not find a strong match for "${question}" in the processed documents, but you can ask me to summarize a specific file, compare two document names, or search for dates, emails, IDs, and amounts. How can I help you narrow it down?`
        : "I can chat with you and explain MandVision now. Once you upload and process PDFs or Word documents, I can also summarize, compare, and answer questions about them. How can I help you today?";
    }

    return `I could not find a match for "${question}" in the extracted documents.`;
  }

  const topValues = matches.flatMap((match) => getIntentValues(match.item, intent)).slice(0, 4);

  if (topValues.length > 0) {
    return `I found ${topValues.length} relevant detail${topValues.length === 1 ? "" : "s"}: ${topValues.join("; ")}.`;
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

function getInsightValues(item: MediaResult) {
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
