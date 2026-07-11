"use client";

import { AlertTriangle, Bot, FileSearch, Search, Send, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
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
  "What does this system do?",
  "What objects were detected?",
  "Does this image show a bag?",
  "What should I review first?",
];

export function DocumentAssistantCard({
  items,
  selectedItem,
  onSelectItem,
  onFilterTermChange,
  compact = false,
}: {
  items: MediaResult[];
  selectedItem?: MediaResult | null;
  onSelectItem: (item: MediaResult) => void;
  onFilterTermChange: (term: string) => void;
  compact?: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [searchSelectedOnly, setSearchSelectedOnly] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "**Welcome to VisoAI.**\n\nSelect an uploaded image or document, then ask what MandVision detected or what details need review.",
      answer: {
        question: "welcome",
        summary:
          "**Welcome to VisoAI.**\n\nSelect an uploaded image or document, then ask what MandVision detected or what details need review.",
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
  const selectedImage = selectedItem?.mediaType === "image" ? selectedItem : null;
  const searchableDocuments = useMemo(
    () => (searchSelectedOnly && selectedDocument ? [selectedDocument] : documents),
    [documents, searchSelectedOnly, selectedDocument]
  );
  const suggestedQuestions = useMemo(
    () =>
      selectedImage
        ? buildImageSuggestedQuestions(selectedImage)
        : buildSuggestedQuestions(selectedDocument),
    [selectedDocument, selectedImage]
  );
  const promptSuggestions = useMemo(
    () => Array.from(new Set([...suggestedQuestions, ...quickQuestions])).slice(0, 6),
    [suggestedQuestions]
  );
  const hasUserMessages = messages.some((message) => message.role === "user");

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

    const socialAnswer = buildSocialAnswer(cleanQuestion);
    if (socialAnswer) {
      addAssistantMessage(socialAnswer);
      return;
    }

    if (selectedImage) {
      void askVisionBackend(cleanQuestion, selectedImage);
      return;
    }

    const appAnswer = buildAppAnswer(cleanQuestion);
    if (appAnswer) {
      addAssistantMessage(appAnswer);
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
    if (!scopedDocuments.length) {
      addAssistantMessage(buildAnswer(nextQuestion, [], true));
      return;
    }

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

  async function askVisionBackend(nextQuestion: string, image: MediaResult) {
    const fallbackAnswer = buildImageAnswer(nextQuestion, image);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        addAssistantMessage({
          ...fallbackAnswer,
          aiError: "AI vision is unavailable right now, so I’m showing the saved image labels.",
        });
        return;
      }

      setAskingBackend(true);

      const response = await fetch(`${apiUrl}/vision/ask?requestId=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: nextQuestion,
          fileId: image.fileId,
        }),
      });

      if (!response.ok) {
        addAssistantMessage({
          ...fallbackAnswer,
          aiError: "AI vision is unavailable right now, so I’m showing the saved image labels.",
        });
        return;
      }

      const data = (await response.json()) as {
        answer?: string;
        mode?: string;
        aiError?: string;
      };

      addAssistantMessage({
        question: nextQuestion,
        summary: data.answer || fallbackAnswer.summary,
        mode: data.mode || "vision",
        aiError: data.aiError,
        matches: fallbackAnswer.matches,
      });
    } catch (error) {
      console.error("Could not ask vision endpoint", error);
      addAssistantMessage({
        ...fallbackAnswer,
        aiError: "AI vision is unavailable right now, so I’m showing the saved image labels.",
      });
    } finally {
      setAskingBackend(false);
    }
  }

  return (
    <section className={compact ? "" : "mx-auto max-w-[118rem] px-4 pt-6 sm:px-6"}>
      <div className="rounded-2xl border border-white/10 bg-[#0d131c] p-4 text-white shadow-2xl shadow-black/20 sm:p-6">
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
                Ask about the selected image, detected objects, or processed document text.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
            {selectedImage
              ? `${selectedImage.labels?.length || 0} image label${
                  selectedImage.labels?.length === 1 ? "" : "s"
                } ready`
              : `VisoAI can read ${searchableDocuments.length} doc${
                  searchableDocuments.length === 1 ? "" : "s"
                }`}
          </div>
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
                <div className="ai-assistant-bubble min-w-0 flex-1 rounded-2xl rounded-tl-md border border-sky-300/20 bg-[#0d1722] p-4 text-sm text-slate-100">
                  <div className="mb-2 text-xs font-medium text-sky-200">VisoAI</div>
                  {selectedImage ? "Thinking about the selected image..." : "Reading your processed documents..."}
                </div>
              </div>
            ) : null}
            <div className="border-t border-white/10 pt-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {selectedDocument ? (
                  <>
                    {!hasUserMessages ? (
                      <button
                        type="button"
                        onClick={summarizeSelectedDocument}
                        disabled={askingBackend}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Summarize this document
                      </button>
                    ) : null}
                    <label className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={searchSelectedOnly}
                        onChange={(event) => setSearchSelectedOnly(event.target.checked)}
                        className="h-3.5 w-3.5 accent-sky-300"
                      />
                      Search selected only
                    </label>
                  </>
                ) : null}
                {!hasUserMessages
                  ? promptSuggestions.map((quickQuestion) => (
                      <button
                        key={quickQuestion}
                        type="button"
                        onClick={() => askQuestion(quickQuestion)}
                        className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-sky-300/40 hover:bg-sky-300/10 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {quickQuestion}
                      </button>
                    ))
                  : null}
              </div>
              <form
                className="flex flex-col gap-3 sm:flex-row"
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
            </div>
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
      <div className="ai-assistant-bubble min-w-0 flex-1 rounded-2xl rounded-tl-md border border-sky-300/20 bg-[#0d1722] p-4 text-sm text-slate-100">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="ai-assistant-name text-xs font-semibold text-sky-200">VisoAI</span>
          {answer?.mode === "vision" ? (
            <span className="ai-answer-badge inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[11px] font-medium text-emerald-100">
              <Sparkles className="h-3 w-3" />
              Vision answer
            </span>
          ) : answer?.mode === "ai" ? (
            <span className="ai-answer-badge inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[11px] font-medium text-emerald-100">
              <Sparkles className="h-3 w-3" />
              Document answer
            </span>
          ) : answer?.mode === "image" ? (
            <span className="ai-answer-badge inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[11px] font-medium text-emerald-100">
              <Sparkles className="h-3 w-3" />
              Image labels
            </span>
          ) : answer?.mode === "fallback" ? (
            <span className="ai-answer-badge inline-flex items-center gap-1.5 rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-0.5 text-[11px] font-medium text-sky-100">
              <FileSearch className="h-3 w-3" />
              Smart search
            </span>
          ) : null}
        </div>
        <MarkdownMessage text={message.text} />
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

function MarkdownMessage({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let unorderedItems: string[] = [];
  let orderedItems: string[] = [];

  function flushUnorderedList(key: string) {
    if (!unorderedItems.length) return;

    blocks.push(
      <ul key={key} className="list-disc space-y-1 pl-5 text-slate-100">
        {unorderedItems.map((item, index) => (
          <li key={`${key}-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    );
    unorderedItems = [];
  }

  function flushOrderedList(key: string) {
    if (!orderedItems.length) return;

    blocks.push(
      <ol key={key} className="list-decimal space-y-1 pl-5 text-slate-100">
        {orderedItems.map((item, index) => (
          <li key={`${key}-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ol>
    );
    orderedItems = [];
  }

  text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
      const orderedMatch = line.match(/^\d+\.\s+(.+)$/);

      if (unorderedMatch) {
        flushOrderedList(`ol-before-${index}`);
        unorderedItems.push(unorderedMatch[1]);
        return;
      }

      if (orderedMatch) {
        flushUnorderedList(`ul-before-${index}`);
        orderedItems.push(orderedMatch[1]);
        return;
      }

      flushUnorderedList(`ul-${index}`);
      flushOrderedList(`ol-${index}`);

      const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        blocks.push(
          <p key={`heading-${index}`} className="font-semibold text-white">
            {renderInlineMarkdown(headingMatch[2])}
          </p>
        );
        return;
      }

      blocks.push(
        <p key={`paragraph-${index}`} className="text-slate-100">
          {renderInlineMarkdown(line)}
        </p>
      );
    });

  flushUnorderedList("ul-end");
  flushOrderedList("ol-end");

  return <div className="space-y-2 leading-6">{blocks}</div>;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`bold-${index}`} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={`code-${index}`} className="rounded bg-black/30 px-1 py-0.5 text-sky-100">
          {part.slice(1, -1)}
        </code>
      );
    }

    return <span key={`text-${index}`}>{part}</span>;
  });
}

function buildSocialAnswer(question: string): AssistantAnswer | null {
  const normalized = question.toLowerCase();
  const makeAnswer = (summary: string, mode = "chat"): AssistantAnswer => ({
    question,
    summary,
    mode,
    matches: [],
  });

  if (/\b(hi|hello|hey|how are you|how's it going|good morning|good afternoon|good evening)\b/.test(normalized)) {
    return makeAnswer(
      "**Hey, I’m here.**\n\nAsk me naturally about the selected image or document. I’ll answer in plain English and use the detected labels or extracted text as my evidence."
    );
  }

  if (/\b(thanks|thank you|appreciate)\b/.test(normalized)) {
    return makeAnswer(
      "**Anytime.**\n\nKeep the questions coming. I can help identify what the image likely shows, point out what I’m confident about, and be clear when the current analysis is limited."
    );
  }

  if (/\b(who are you|what are you|what can you do)\b/.test(normalized)) {
    return makeAnswer(
      "**I’m VisoAI.**\n\nI’m a friendly review assistant for MandVision. I can talk through selected images, explain detected labels in normal language, and help search processed document text."
    );
  }

  if (/\b(don't|do not|dont|stop|cancel)\b.*\b(process|scan|analyze|analyse|upload)\b/.test(normalized)) {
    return makeAnswer(
      "**No problem.**\n\nI won’t start any upload or processing from chat. Processing only happens when you choose a file on the Upload page and press the upload button. If an image is already selected here, I’m only reading the saved detection results."
    );
  }

  return null;
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

function buildImageSuggestedQuestions(selectedImage: MediaResult) {
  const labels = getSortedLabels(selectedImage);
  const topLabels = labels.slice(0, 3).map((label) => label.name).filter(Boolean);
  const questions = new Set<string>();

  questions.add("What objects were detected?");
  questions.add("What should I review first?");

  if (topLabels[0]) questions.add(`Does this image show ${topLabels[0]}?`);
  if (topLabels[1]) questions.add(`Tell me about the ${topLabels[1]} in this image`);
  if (topLabels[2]) questions.add(`Is there anything suspicious about ${topLabels[2]}?`);

  return Array.from(questions).slice(0, 4);
}

function buildImageAnswer(question: string, image: MediaResult): AssistantAnswer {
  const cleanQuestion = question.trim();
  const labels = getSortedLabels(image);
  const normalized = cleanQuestion.toLowerCase();
  const topLabels = labels.slice(0, 8);
  const labelNames = topLabels
    .map((label) => `${label.name}${label.confidence ? ` (${Math.round(label.confidence)}%)` : ""}`)
    .join(", ");
  const terms = getImageQuestionTerms(cleanQuestion);
  const matchingLabels = labels.filter((label) => {
    const name = label.name?.toLowerCase() || "";
    return terms.some((term) => name.includes(term) || term.includes(name));
  });
  const isPresenceQuestion = /\b(do you see|does|is there|are there|can you see|see|show|contains?|find|identify)\b/.test(normalized);
  const isDescriptionQuestion = /\b(describe|pattern|type|kind|color|wearing|looks like|tell me about)\b/.test(normalized);
  const isRiskQuestion = /\b(blood|weapon|knife|gun|injury|suspicious|danger|hazard|threat|evidence)\b/.test(normalized);
  const isTextQuestion = /\b(word|words|text|read|writing|letter|letters|says|sign|ocr)\b/.test(normalized);
  const isAnimalNameQuestion =
    /\b(what|which|name|called|kind|type)\b.*\b(animal|pet|creature)\b/.test(normalized) ||
    /\b(animal|pet|creature)\b.*\b(called|kind|type|name)\b/.test(normalized);
  const requestedAnimal = getRequestedAnimal(normalized);
  const inferredAnimal = inferAnimalFromLabels(labels);
  let summary: string;
  let snippets: string[] = [];

  if (!labels.length) {
    summary =
      "**I can see that an image is selected, but I don’t have labels for it yet.**\n\nTry reprocessing it or selecting a completed image from Library, then ask me again.";
  } else if (isTextQuestion) {
    const topObjects = topLabels
      .map((label) => `- ${label.name}${label.confidence ? ` (${Math.round(label.confidence)}%)` : ""}`)
      .join("\n");
    summary =
      `**I can see the selected image, but I do not have OCR text for it yet.**\n\n` +
      `MandVision’s current image analysis returns object labels, not readable words from inside the picture.\n\n` +
      `**Detected image labels:**\n\n${topObjects || "- Not available"}`;
  } else if (isAnimalNameQuestion && inferredAnimal) {
    summary =
      `**It looks like a ${inferredAnimal.name.toLowerCase()}.**\n\n` +
      `${inferredAnimal.detail}\n\n` +
      `**Why I’m saying that:**\n${inferredAnimal.evidence}`;
    snippets = inferredAnimal.snippets;
  } else if (requestedAnimal) {
    const animalAnswer = answerRequestedAnimal(requestedAnimal, labels, inferredAnimal);
    summary = animalAnswer.summary;
    snippets = animalAnswer.snippets;
  } else if (matchingLabels.length) {
    const matches = matchingLabels
      .slice(0, 5)
      .map((label) => `- ${label.name}${label.confidence ? ` at ${Math.round(label.confidence)}% confidence` : ""}`)
      .join("\n");
    summary = `**Yes, I see that in the selected image.**\n\n${matches}`;
    snippets = matchingLabels
      .slice(0, 4)
      .map((label) => `${label.name}${label.confidence ? ` detected at ${Math.round(label.confidence)}% confidence` : ""}`);

    if (isDescriptionQuestion) {
      summary +=
        "\n\n**Note:** I can confirm the detected object category from the current analysis, but detailed visual descriptions like fabric pattern, exact color, or condition need a deeper vision model pass.";
    }
  } else if (isPresenceQuestion || isRiskQuestion) {
    summary = `**I don’t see that in the current labels.**\n\nThe strongest detections are: ${labelNames || "not available"}.`;

    if (isRiskQuestion) {
      summary +=
        "\n\n**Review guidance:** Treat this as a first-pass screening result, not a final forensic conclusion. A human reviewer should verify sensitive evidence such as blood, weapons, or injury indicators.";
    }
  } else {
    const topObjects = topLabels
      .map((label) => `- ${label.name}${label.confidence ? ` (${Math.round(label.confidence)}%)` : ""}`)
      .join("\n");
    summary = `**Here’s what I can tell from the selected image:**\n\n${topObjects || "- Not available"}\n\nYou can ask me things like “is it a dog?”, “what animal is it?”, or “what should I review first?”`;
  }

  return {
    question: cleanQuestion,
    summary,
    mode: "image",
    matches: snippets.length
      ? [
          {
            item: image,
            score: matchingLabels.length,
            snippets,
          },
        ]
      : [],
  };
}

function inferAnimalFromLabels(labels: MediaResult["labels"]) {
  const sortedLabels = getSortedLabels({ labels } as MediaResult);
  const dogLabels = findLabels(sortedLabels, ["dog", "canine", "puppy", "bulldog", "boxer", "hound", "retriever", "terrier"]);
  const catLabels = findLabels(sortedLabels, ["cat", "kitten", "feline"]);

  if (dogLabels.length) {
    const breedLabel = dogLabels.find((label) => !["dog", "canine", "animal"].includes(label.name?.toLowerCase() || ""));
    const evidence = dogLabels
      .slice(0, 4)
      .map((label) => `- ${label.name}${label.confidence ? ` (${Math.round(label.confidence)}%)` : ""}`)
      .join("\n");

    return {
      name: "Dog",
      detail: breedLabel
        ? `It may be a ${breedLabel.name?.toLowerCase()}, based on the breed-style label MandVision detected.`
        : "MandVision detected dog/canine-style labels, so the simplest answer is dog.",
      evidence,
      snippets: dogLabels
        .slice(0, 3)
        .map((label) => `${label.name}${label.confidence ? ` detected at ${Math.round(label.confidence)}% confidence` : ""}`),
    };
  }

  if (catLabels.length) {
    const evidence = catLabels
      .slice(0, 4)
      .map((label) => `- ${label.name}${label.confidence ? ` (${Math.round(label.confidence)}%)` : ""}`)
      .join("\n");

    return {
      name: "Cat",
      detail: "MandVision detected cat/feline-style labels, so the simplest answer is cat.",
      evidence,
      snippets: catLabels
        .slice(0, 3)
        .map((label) => `${label.name}${label.confidence ? ` detected at ${Math.round(label.confidence)}% confidence` : ""}`),
    };
  }

  const animalLabels = findLabels(sortedLabels, ["animal", "pet"]);
  if (!animalLabels.length) return null;

  return {
    name: "Animal",
    detail: "MandVision can tell there is an animal, but it did not provide a specific species label.",
    evidence: animalLabels
      .slice(0, 4)
      .map((label) => `- ${label.name}${label.confidence ? ` (${Math.round(label.confidence)}%)` : ""}`)
      .join("\n"),
    snippets: animalLabels
      .slice(0, 3)
      .map((label) => `${label.name}${label.confidence ? ` detected at ${Math.round(label.confidence)}% confidence` : ""}`),
  };
}

function getRequestedAnimal(normalizedQuestion: string) {
  if (/\b(dog|puppy|canine|bulldog|boxer)\b/.test(normalizedQuestion)) return "dog";
  if (/\b(cat|kitten|feline)\b/.test(normalizedQuestion)) return "cat";
  return "";
}

function answerRequestedAnimal(
  requestedAnimal: string,
  labels: MediaResult["labels"],
  inferredAnimal: ReturnType<typeof inferAnimalFromLabels>
) {
  const sortedLabels = getSortedLabels({ labels } as MediaResult);
  const requestedLabels =
    requestedAnimal === "dog"
      ? findLabels(sortedLabels, ["dog", "canine", "puppy", "bulldog", "boxer", "hound", "retriever", "terrier"])
      : findLabels(sortedLabels, ["cat", "kitten", "feline"]);

  if (requestedLabels.length) {
    const evidence = requestedLabels
      .slice(0, 4)
      .map((label) => `- ${label.name}${label.confidence ? ` (${Math.round(label.confidence)}%)` : ""}`)
      .join("\n");

    return {
      summary: `**Yes, it looks like a ${requestedAnimal}.**\n\n${evidence}`,
      snippets: requestedLabels
        .slice(0, 3)
        .map((label) => `${label.name}${label.confidence ? ` detected at ${Math.round(label.confidence)}% confidence` : ""}`),
    };
  }

  if (inferredAnimal?.name && inferredAnimal.name.toLowerCase() !== requestedAnimal) {
    return {
      summary:
        `**I don’t think it’s a ${requestedAnimal}.**\n\n` +
        `It looks more like a ${inferredAnimal.name.toLowerCase()} based on the detected labels.\n\n` +
        `**Evidence:**\n${inferredAnimal.evidence}`,
      snippets: inferredAnimal.snippets,
    };
  }

  const strongestLabels = sortedLabels
    .slice(0, 5)
    .map((label) => `- ${label.name}${label.confidence ? ` (${Math.round(label.confidence)}%)` : ""}`)
    .join("\n");

  return {
    summary:
      `**I don’t see a clear ${requestedAnimal} label.**\n\n` +
      `Here are the strongest labels MandVision found:\n${strongestLabels || "- Not available"}`,
    snippets: [],
  };
}

function findLabels(labels: MediaResult["labels"], terms: string[]) {
  return (labels || []).filter((label) => {
    const labelName = label.name?.toLowerCase() || "";
    return terms.some((term) => labelName.includes(term));
  });
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

  if (/\b(help|how does this work|how do i use|how to use|what can you do|visoai|ai|assistant|ask|question|summary|summarize|source|snippet)\b/.test(normalized)) {
    return makeAnswer(
      "**Absolutely, here’s the simple version.**\n\n1. Upload an image or document.\n2. Open it from Library.\n3. Ask me normal questions about it.\n\nFor images, I can explain the detected objects in plain English. For documents, I can summarize or search the extracted text. I’ll also tell you when I’m limited, like if OCR or deeper visual reasoning is not available yet."
    );
  }

  if (/\b(image|images|picture|pictures|photo|photos|jpg|jpeg|png|scan pictures|scan photos|scan images|rekognition|label|labels|object|objects)\b/.test(normalized)) {
    return makeAnswer(
      "**Yes — MandVision scans images.**\n\n- Supports JPG and PNG images\n- Identifies visible objects with confidence scores\n- Stores processed results in Library\n\nSelect an image, then ask VisoAI whether a specific object appears or what labels should be reviewed first."
    );
  }

  if (/\b(upload|uploads|file|files|pdf|pdfs|doc|docs|docx|process|processing|scan|extract|extraction)\b/.test(normalized)) {
    return makeAnswer(
      "**Use Upload to add new files.**\n\nMandVision supports:\n- JPG and PNG images\n- PDF documents\n- DOC and DOCX files\n\nAfter processing, searchable results appear in Library."
    );
  }

  if (/\b(library|manage|delete|favorite|filter|export|history|download|preview)\b/.test(normalized)) {
    return makeAnswer(
      "**Library is your review workspace.**\n\nFrom Library you can:\n- Preview processed files\n- Filter results\n- Mark favorites\n- Export CSV data\n- Download originals\n- Delete uploads you no longer need"
    );
  }

  if (/\b(sign|login|log in|account|password|auth|cognito|user)\b/.test(normalized)) {
    return makeAnswer(
      "**Accounts keep uploads tied to the right user.**\n\nSign in to view your files and manage account actions like password recovery or account deletion."
    );
  }

  if (/\b(app|mandvision|help|how do i|what can|where do i)\b/.test(normalized)) {
    return makeAnswer(
      "**MandVision helps you review uploaded files.**\n\nUpload a file, pick it in Library, then ask me what it shows or what details matter. Think of me as a first-pass review assistant, not a final investigator."
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
        ? `**No strong match found.**\n\nI did not find a strong match for "${question}" in the processed documents.\n\nTry asking for:\n- A summary of a specific file\n- Dates, emails, IDs, or amounts\n- A comparison between two document names`
        : noDocumentAnswer(question);
    }

    return `**No document match found.**\n\nI could not find a match for "${question}" in the extracted documents.`;
  }

  const topValues = matches.flatMap((match) => getIntentValues(match.item, intent)).slice(0, 4);

  if (topValues.length > 0) {
    const details = topValues.map((value) => `- ${value}`).join("\n");
    return `**Found ${topValues.length} relevant detail${topValues.length === 1 ? "" : "s"}.**\n\n${details}`;
  }

  return `**Found matching documents.**\n\n${matches.length} document${matches.length === 1 ? "" : "s"} match "${question}".`;
}

function noDocumentAnswer(question: string) {
  const normalized = question.toLowerCase();

  if (/\b(image|images|picture|pictures|photo|photos|jpg|jpeg|png|rekognition|label|labels|object|objects)\b/.test(normalized)) {
    return "**Yes — MandVision can scan images.**\n\nUpload a JPG or PNG, select the processed image in Library, and I can answer from the detected object labels.";
  }

  if (/\b(pdf|pdfs|doc|docs|docx|document|documents|extract|summary|summarize|compare)\b/.test(normalized)) {
    return "**No readable documents are available yet.**\n\nI can help with documents after you upload and process a PDF, DOC, or DOCX in this account. I can explain the workflow, but I will not reference files that are not yours.";
  }

  return "**I can explain MandVision now.**\n\nOnce you upload and select an image or document in Library, I can help with:\n- Object labels\n- Summaries\n- Comparisons\n- Searches";
}

function getSortedLabels(item: MediaResult) {
  return [...(item.labels || [])]
    .filter((label) => label.name)
    .sort((first, second) => (second.confidence || 0) - (first.confidence || 0));
}

function getSearchTerms(question: string) {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9@.$/-]+/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !stopWords.has(term));
}

function getImageQuestionTerms(question: string) {
  const baseTerms = getSearchTerms(question);
  const aliasMap: Record<string, string[]> = {
    bag: ["bag", "handbag", "purse", "backpack", "luggage", "accessory"],
    purse: ["purse", "handbag", "bag", "accessory"],
    handbag: ["handbag", "purse", "bag", "accessory"],
    sweater: ["sweater", "clothing", "apparel", "shirt", "top", "person"],
    hoodie: ["hoodie", "clothing", "apparel", "shirt", "top", "person"],
    jacket: ["jacket", "coat", "clothing", "apparel", "person"],
    shoe: ["shoe", "footwear", "sneaker", "boot"],
    shoes: ["shoe", "footwear", "sneaker", "boot"],
    blood: ["blood", "stain", "red"],
    weapon: ["weapon", "gun", "knife"],
    car: ["car", "vehicle", "automobile"],
    phone: ["phone", "mobile phone", "cell phone", "electronics"],
  };
  const expandedTerms = new Set(baseTerms);

  for (const term of baseTerms) {
    aliasMap[term]?.forEach((alias) => expandedTerms.add(alias));
  }

  return Array.from(expandedTerms);
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
