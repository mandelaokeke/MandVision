"use client";

import { Clock3, Images, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { MediaResult } from "@/hooks/useUpload";

function formatDate(value?: string) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function HistoryCard({
  items,
  selectedFileId,
  onSelectItem,
}: {
  items: MediaResult[];
  selectedFileId?: string;
  onSelectItem: (item: MediaResult) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) return items;

    return items.filter((item) => {
      const fileName = item.originalFileName?.toLowerCase() || "";
      const labels = item.labels?.map((label) => label.name?.toLowerCase()).join(" ") || "";

      return fileName.includes(query) || labels.includes(query);
    });
  }, [items, searchTerm]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d131c] text-white shadow-2xl shadow-black/20">
      <div className="space-y-4 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-emerald-300">
            <Images className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Upload History</h2>
            <p className="text-sm text-slate-400">
              Recent images processed by MandVision
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by file name or label..."
            className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 pl-9 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
          />
        </div>
      </div>

      <div className="space-y-4 p-6 pt-0">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => {
            const topLabels = item.labels?.slice(0, 3) || [];
            const isSelected = item.fileId === selectedFileId;

            return (
              <button
                type="button"
                key={item.fileId}
                onClick={() => onSelectItem(item)}
                className={`w-full rounded-xl border p-4 text-left transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.03] ${
                  isSelected
                    ? "border-emerald-400/50 bg-emerald-400/[0.06]"
                    : "border-white/10 bg-black/20"
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">
                      {item.originalFileName || item.fileId}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      <span>{formatDate(item.processedAt || item.uploadedAt)}</span>
                    </div>
                  </div>

                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    {item.status || "UNKNOWN"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {topLabels.length > 0 ? (
                    topLabels.map((label) => (
                      <span
                        key={`${item.fileId}-${label.name}`}
                        className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs text-slate-300"
                      >
                        {label.name} {label.confidence ? `${Math.round(label.confidence)}%` : ""}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">No labels available</span>
                  )}
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-slate-400">
            No uploads found yet.
          </div>
        )}
      </div>
    </div>
  );
}