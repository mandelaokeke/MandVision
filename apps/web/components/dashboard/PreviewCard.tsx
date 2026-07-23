import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UploadStage } from "@/hooks/useUpload";
import { ProcessingTimeline } from "./ProcessingTimeline";
import { FileText } from "lucide-react";

export function PreviewCard({
  fileName,
  previewUrl,
  stage,
  progressLabel,
  uploadedAt,
  historicalSelected = false,
  previewLoading = false,
  mediaType,
  fileType,
  textPreview,
}: {
  fileName?: string;
  previewUrl: string | null;
  stage: UploadStage;
  progressLabel: string;
  uploadedAt?: string;
  historicalSelected?: boolean;
  previewLoading?: boolean;
  mediaType?: "image" | "document" | "unknown";
  fileType?: string;
  textPreview?: string;
}) {
  const isDocument = mediaType === "document";
  const isPdf =
    fileType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");

  return (
    <Card className="rounded-2xl border-white/10 bg-[#0d131c] text-white shadow-2xl shadow-black/20">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="truncate text-base text-slate-100">
          {fileName || "No file selected"}
        </CardTitle>
        <Badge className="border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/10">
          {progressLabel}
        </Badge>
      </CardHeader>

      <CardContent>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
          {previewUrl && isPdf ? (
            <iframe
              src={previewUrl}
              title={fileName ? `${fileName} preview` : "PDF preview"}
              className="h-64 w-full bg-white sm:h-80"
            />
          ) : previewUrl && !isDocument ? (
            <img
              src={previewUrl}
              alt="Selected upload preview"
              className="h-64 w-full bg-black/40 object-contain sm:h-80"
            />
          ) : isDocument ? (
            <DocumentFace fileName={fileName} textPreview={textPreview} fileType={fileType} />
          ) : historicalSelected ? (
            <div className="flex h-64 flex-col items-center justify-center px-6 text-center text-slate-400 sm:h-80 sm:px-8">
              <p className="font-semibold text-slate-200">
                {previewLoading ? "Loading historical preview..." : "Historical upload selected"}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {previewLoading
                  ? "Fetching a secure S3 preview URL for this image."
                  : "Preview image is unavailable. Metadata and Rekognition results have been loaded from history."}
              </p>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-slate-500 sm:h-80">
              File preview will appear here
            </div>
          )}
        </div>

        <ProcessingTimeline stage={stage} uploadedAt={uploadedAt} />
      </CardContent>
    </Card>
  );
}

function DocumentFace({
  fileName,
  textPreview,
  fileType,
}: {
  fileName?: string;
  textPreview?: string;
  fileType?: string;
}) {
  const previewLines = textPreview
    ? textPreview.split(/\s+/).join(" ").slice(0, 520)
    : "";
  const isWordDocument =
    fileType === "application/msword" ||
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName?.toLowerCase().endsWith(".doc") ||
    fileName?.toLowerCase().endsWith(".docx");

  return (
    <div className="flex h-64 items-center justify-center bg-slate-950/80 p-4 sm:h-80 sm:p-5">
      <div className="h-full w-full max-w-sm overflow-hidden rounded-lg border border-slate-200/15 bg-slate-100 p-5 text-slate-900 shadow-2xl shadow-black/40">
        <div className="mb-4 flex items-center gap-3 border-b border-slate-300 pb-3">
          <FileText className="h-7 w-7 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {fileName || "Document preview"}
            </p>
            <p className="text-xs text-slate-500">
              {isWordDocument ? "Word document face" : "Extracted document face"}
            </p>
          </div>
        </div>

        {previewLines ? (
          <p className="text-sm leading-6 text-slate-700">{previewLines}</p>
        ) : (
          <div className="space-y-3">
            <div className="h-3 w-4/5 rounded bg-slate-300" />
            <div className="h-3 w-full rounded bg-slate-300" />
            <div className="h-3 w-11/12 rounded bg-slate-300" />
            <div className="h-3 w-3/4 rounded bg-slate-300" />
            <p className="pt-5 text-center text-sm font-medium text-slate-500">
              MandVision will extract searchable text after upload.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
