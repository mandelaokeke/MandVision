

"use client";

import { X, Copy, ImageIcon, RotateCcw, Star, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MediaResult } from "@/hooks/useUpload";

interface ImageDetailsModalProps {
  open: boolean;
  item: MediaResult | null;
  onClose: () => void;
  onDelete?: (item: MediaResult) => void;
  deleting?: boolean;
  onReprocess?: (item: MediaResult) => void;
  reprocessing?: boolean;
  favorite?: boolean;
  onToggleFavorite?: (item: MediaResult) => void;
}

export function ImageDetailsModal({
  open,
  item,
  onClose,
  onDelete,
  deleting = false,
  onReprocess,
  reprocessing = false,
  favorite = false,
  onToggleFavorite,
}: ImageDetailsModalProps) {
  if (!open || !item) return null;

  const copyFileId = async () => {
    try {
      await navigator.clipboard.writeText(item.fileId);
    } catch (e) {
      console.error("Failed to copy file ID", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <Card className="w-full max-w-3xl rounded-2xl border-white/10 bg-[#0d131c] text-white">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Image Details</CardTitle>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-center text-slate-400">
            <ImageIcon className="mx-auto mb-3 h-10 w-10" />
            Historical preview shown in dashboard.
          </div>

          <div className="grid gap-3 text-sm">
            <Detail label="File ID" value={item.fileId} />
            <Detail label="Object Key" value={item.objectKey ?? "—"} />
            <Detail label="Filename" value={item.originalFileName ?? "—"} />
            <Detail label="Status" value={item.status ?? "UNKNOWN"} />
            <Detail label="Processed" value={item.processedAt ?? "—"} />
          </div>

          <div>
            <h3 className="mb-2 font-semibold">Detected Labels</h3>
            <div className="flex flex-wrap gap-2">
              {(item.labels ?? []).map((label, index) => (
                <Badge key={`${label.name}-${index}`}>
                  {label.name} {label.confidence ? `(${label.confidence.toFixed(1)}%)` : ""}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            {onReprocess && item.status !== "PROCESSED" ? (
              <button
                type="button"
                onClick={() => onReprocess(item)}
                disabled={reprocessing}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 px-4 py-2 text-emerald-300 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className={`h-4 w-4 ${reprocessing ? "animate-spin" : ""}`} />
                {reprocessing ? "Reprocessing..." : "Reprocess"}
              </button>
            ) : null}
            {onToggleFavorite ? (
              <button
                type="button"
                onClick={() => onToggleFavorite(item)}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 ${
                  favorite
                    ? "border-amber-300/40 bg-amber-300/10 text-amber-300"
                    : "border-white/10 text-slate-200 hover:bg-white/10"
                }`}
              >
                <Star className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
                {favorite ? "Favorited" : "Add Favorite"}
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(item)}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 px-4 py-2 text-red-300 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting..." : "Delete Image"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={copyFileId}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 hover:bg-white/10"
            >
              <Copy className="h-4 w-4" />
              Copy File ID
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
      <span className="text-slate-400">{label}</span>
      <span className="max-w-[60%] break-all text-right">{value}</span>
    </div>
  );
}
