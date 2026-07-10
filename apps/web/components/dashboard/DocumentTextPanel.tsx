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
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-xs text-slate-500">
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
              className="h-9 w-44 rounded-lg border border-white/10 bg-black/20 px-3 pl-8 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-40"
            />
          </div>
          <button
            type="button"
            onClick={copyExtractedText}
            disabled={!extractedText}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
          <button
            type="button"
            onClick={downloadExtractedText}
            disabled={!extractedText}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-400/30 px-3 text-xs text-emerald-300 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </div>
      </div>
      <div
        className={`${maxHeightClass} overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-5 text-sm leading-6 text-slate-300`}
      >
        {segments.length > 0
          ? segments.map((segment, index) =>
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
            )
          : "No extracted text available yet."}
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
