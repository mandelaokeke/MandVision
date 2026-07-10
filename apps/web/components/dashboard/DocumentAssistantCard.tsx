"use client";

import { AlertTriangle, Bot, FileSearch, Search, Sparkles } from "lucide-react";
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

const quickQuestions = [
  "What invoice totals are in my documents?",
  "Which documents mention an email?",
  "Find phone numbers",
  "Show documents with dates",
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
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [searchSelectedOnly, setSearchSelectedOnly] = useState(false);
  const [backendAnswer, setBackendAnswer] = useState<AssistantAnswer | null>(null);
  const [backendError, setBackendError] = useState("");
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
  const answer = useMemo(
    () => buildAnswer(submittedQuestion, searchableDocuments),
    [submittedQuestion, searchableDocuments]
  );
  const visibleAnswer =
    backendAnswer?.question === submittedQuestion ? backendAnswer : answer;

  function askQuestion(nextQuestion = question) {
    const cleanQuestion = nextQuestion.trim();
    if (!cleanQuestion) return;

    setQuestion(cleanQuestion);
    setSubmittedQuestion(cleanQuestion);
    setBackendAnswer(null);
    setBackendError("");
    void askBackend(cleanQuestion, searchableDocuments);
  }

  function summarizeSelectedDocument() {
    if (!selectedDocument) return;

    const cleanQuestion = `Summarize ${selectedDocument.originalFileName || "this document"}`;
    setSearchSelectedOnly(true);
    setQuestion(cleanQuestion);
    setSubmittedQuestion(cleanQuestion);
    setBackendAnswer(null);
    setBackendError("");
    void askBackend(cleanQuestion, [selectedDocument]);
  }

  async function askBackend(nextQuestion: string, scopedDocuments: MediaResult[]) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) return;

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
        setBackendError("AI is unavailable right now, so MandVision is showing a smart search answer.");
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

      setBackendAnswer({
        question: nextQuestion,
        summary: data.answer || answer.summary,
        mode: data.mode,
        aiError: data.aiError,
        matches,
      });
      setBackendError(data.aiError || "");
    } catch (error) {
      console.error("Could not ask document endpoint", error);
      setBackendError("AI is unavailable right now, so MandVision is showing a smart search answer.");
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
                Phase 5.2
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Ask MandVision</h2>
              <p className="mt-1 text-sm text-slate-400">
                Ask questions across extracted document text and detected key details.
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
              placeholder="Ask about invoices, dates, emails, totals, or document text..."
              className="h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 pl-9 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
            />
          </div>
          <button
            type="submit"
            disabled={!question.trim() || documents.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-sky-300/30 bg-sky-300/10 px-4 text-sm font-medium text-sky-200 transition hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles className="h-4 w-4" />
            {askingBackend ? "Asking..." : "Ask"}
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
          {[...suggestedQuestions, ...quickQuestions].map((quickQuestion) => (
            <button
              key={quickQuestion}
              type="button"
              onClick={() => askQuestion(quickQuestion)}
              disabled={documents.length === 0}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-sky-300/40 hover:bg-sky-300/10 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {quickQuestion}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {!submittedQuestion ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-slate-400">
              {documents.length
                ? selectedDocument
                  ? "Try asking about the selected document or search across all extracted documents."
                  : "Try asking for invoice totals, dates, emails, phone numbers, or any phrase inside your documents."
                : "Upload a PDF or DOCX to start asking questions about document content."}
            </div>
          ) : visibleAnswer.summary || visibleAnswer.matches.length > 0 ? (
            <div className="space-y-4">
              <div
                className={`rounded-xl border p-4 text-sm ${
                  visibleAnswer.mode === "ai"
                    ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
                    : "border-sky-300/20 bg-sky-300/10 text-sky-100"
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                      visibleAnswer.mode === "ai"
                        ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                        : "border-sky-300/30 bg-sky-300/10 text-sky-100"
                    }`}
                  >
                    {visibleAnswer.mode === "ai" ? (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        AI answer
                      </>
                    ) : (
                      <>
                        <FileSearch className="h-3.5 w-3.5" />
                        Smart search answer
                      </>
                    )}
                  </span>
                  {askingBackend ? (
                    <span className="text-xs text-slate-300">Checking AI...</span>
                  ) : null}
                </div>
                <div>{visibleAnswer.summary}</div>
                {backendError || visibleAnswer.aiError ? (
                  <div className="mt-3 flex gap-2 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{backendError || visibleAnswer.aiError}</span>
                  </div>
                ) : null}
                {visibleAnswer.matches.length > 0 ? (
                  <div className="mt-4 border-t border-white/10 pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                      Source snippets
                    </p>
                    <div className="space-y-2">
                      {visibleAnswer.matches.slice(0, 3).map((match) => (
                        <div key={`source-${match.item.fileId}`} className="rounded-lg bg-black/20 p-3">
                          <p className="mb-1 truncate text-xs font-medium text-white/80">
                            {match.item.originalFileName || match.item.fileId}
                          </p>
                          <p className="line-clamp-2 text-xs leading-5 text-white/65">
                            {match.snippets[0] || match.item.textPreview || "Source document matched this question."}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              {visibleAnswer.matches.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {visibleAnswer.matches.slice(0, 4).map((match) => (
                  <button
                    key={match.item.fileId}
                    type="button"
                    onClick={() => {
                      onSelectItem(match.item);
                      onFilterTermChange(match.item.originalFileName || match.item.fileId);
                    }}
                    className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition hover:border-sky-300/40 hover:bg-sky-300/[0.04]"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-100">
                          {match.item.originalFileName || match.item.fileId}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {match.item.wordCount || 0} words indexed
                        </p>
                      </div>
                      <FileSearch className="h-4 w-4 shrink-0 text-sky-200" />
                    </div>
                    <div className="space-y-2">
                      {match.snippets.map((snippet) => (
                        <p
                          key={`${match.item.fileId}-${snippet}`}
                          className="line-clamp-2 text-sm leading-5 text-slate-300"
                        >
                          {snippet}
                        </p>
                      ))}
                    </div>
                  </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-slate-400">
              No document matches found. Try a different keyword, amount, date, email, or file name.
            </div>
          )}
        </div>
      </div>
    </section>
  );
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

function buildAnswer(question: string, documents: MediaResult[]): AssistantAnswer {
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
    summary: summarizeAnswer(cleanQuestion, matches, intent),
    matches,
  };
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
  intent: ReturnType<typeof getQuestionIntent>
) {
  if (!matches.length) return `I could not find a match for "${question}" in the extracted documents.`;

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
