"use client";

import { Copy, Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { MediaResult } from "@/hooks/useUpload";
import { downloadTextFile, getExtractedText, getTextExportFileName } from "@/lib/export";

export function DocumentTextPanel({
  item,
  title = "Extracted Text",
  maxHeightClass = "max-h-80",
}: {
  item: MediaResult | null;
  title?: string;
  maxHeightClass?: string;
}) {
  const [query, setQuery] = useState("");
  const extractedText = getExtractedText(item);
  const matches = useMemo(
    () => countMatches(extractedText, query),
    [extractedText, query]
  );
  const segments = useMemo(
    () => buildHighlightedSegments(extractedText, query),
    [extractedText, query]
  );
  const paragraphs = useMemo(
    () => splitIntoReadableParagraphs(extractedText),
    [extractedText]
  );

  const copyExtractedText = async () => {
    if (!extractedText) return;

    try {
      await navigator.clipboard.writeText(extractedText);
    } catch (error) {
      console.error("Failed to copy extracted text", error);
    }
  };

  const downloadExtractedText = () => {
    downloadTextFile({
      contents: extractedText,
      fileName: getTextExportFileName(item),
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <div className="flex flex-col gap-4 border-b border-white/10 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {query.trim()
              ? `${matches} match${matches === 1 ? "" : "es"}`
              : extractedText
                ? "Search within extracted text"
                : "No extracted text available yet"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={!extractedText}
              placeholder="Find text..."
              className="h-10 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 pl-9 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-40 sm:w-64"
            />
          </div>
          <button
            type="button"
            onClick={copyExtractedText}
            disabled={!extractedText}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
          <button
            type="button"
            onClick={downloadExtractedText}
            disabled={!extractedText}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-400/30 px-3 text-sm text-emerald-300 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </div>
      </div>
      <div className={`${maxHeightClass} overflow-auto bg-[#090f16] p-5`}>
        {query.trim() ? (
          <div className="whitespace-pre-wrap rounded-xl border border-white/10 bg-[#0f1722] p-5 text-base leading-8 text-slate-200">
            {segments.map((segment, index) =>
                segment.match ? (
                  <mark
                    key={`${segment.text}-${index}`}
                    className="rounded bg-amber-300/30 px-0.5 text-amber-100"
                  >
                    {segment.text}
                  </mark>
                ) : (
                  <span key={`${segment.text}-${index}`}>{segment.text}</span>
                )
              )}
          </div>
        ) : paragraphs.length > 0 ? (
          <div className="space-y-4">
            {paragraphs.map((paragraph, index) => (
              <p
                key={`${paragraph}-${index}`}
                className="rounded-xl border border-white/10 bg-[#0f1722] p-5 text-base leading-8 text-slate-200"
              >
                {paragraph}
              </p>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-[#0f1722] p-5 text-sm text-slate-400">
            No extracted text available yet.
          </div>
        )}
      </div>
    </div>
  );
}

function countMatches(text: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!text || !normalizedQuery) return 0;

  let count = 0;
  let startIndex = 0;
  const normalizedText = text.toLowerCase();

  while (startIndex < normalizedText.length) {
    const nextIndex = normalizedText.indexOf(normalizedQuery, startIndex);
    if (nextIndex === -1) break;

    count += 1;
    startIndex = nextIndex + normalizedQuery.length;
  }

  return count;
}

function buildHighlightedSegments(text: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!text) return [];
  if (!normalizedQuery) return [{ text, match: false }];

  const normalizedText = text.toLowerCase();
  const segments: { text: string; match: boolean }[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const nextIndex = normalizedText.indexOf(normalizedQuery, startIndex);

    if (nextIndex === -1) {
      segments.push({ text: text.slice(startIndex), match: false });
      break;
    }

    if (nextIndex > startIndex) {
      segments.push({ text: text.slice(startIndex, nextIndex), match: false });
    }

    segments.push({
      text: text.slice(nextIndex, nextIndex + normalizedQuery.length),
      match: true,
    });
    startIndex = nextIndex + normalizedQuery.length;
  }

  return segments;
}

function splitIntoReadableParagraphs(text: string) {
  const cleanText = text.replace(/\s+/g, " ").trim();
  if (!cleanText) return [];

  const sentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return cleanText.match(/.{1,360}(\s|$)/g)?.map((chunk) => chunk.trim()) || [cleanText];
  }

  const paragraphs: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;

    if (next.length > 420 && current) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }

  if (current) paragraphs.push(current);

  return paragraphs;
}
