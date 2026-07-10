import { Eye, FileText } from "lucide-react";
import { DocumentInsightsPanel } from "@/components/dashboard/DocumentInsightsPanel";
import { DocumentTextPanel } from "@/components/dashboard/DocumentTextPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { MediaResult } from "@/hooks/useUpload";

export function ResultsCard({ result }: { result: MediaResult | null }) {
  const labels = result?.labels || [];
  const isDocument = result?.mediaType === "document";

  return (
    <Card className="rounded-2xl border-white/10 bg-[#0d131c] text-white shadow-2xl shadow-black/20">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-emerald-300">
          {isDocument ? <FileText className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-xl">
            {isDocument ? "Extracted Document Text" : "Detected Objects"}
          </CardTitle>
          <p className="text-sm text-slate-400">
            {isDocument
              ? "Text extracted from your PDF or Word document"
              : "Objects identified in your image by Amazon Rekognition"}
          </p>
        </div>
      </CardHeader>

      <CardContent>
        {isDocument ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs text-sky-200">
                {result?.extractionStatus || "DOCUMENT"}
              </span>
              {typeof result?.wordCount === "number" ? (
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                  {result.wordCount} words
                </span>
              ) : null}
            </div>
            <DocumentInsightsPanel insights={result?.documentInsights} />
            <DocumentTextPanel item={result} />
          </div>
        ) : labels.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {labels.slice(0, 12).map((label) => {
              const confidence = Math.round(label.confidence || 0);

              return (
                <div
                  key={`${label.name}-${label.confidence}`}
                  className="rounded-xl border border-white/10 bg-black/20 p-4 transition hover:border-emerald-400/30"
                >
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="truncate font-semibold text-slate-200">{label.name}</span>
                    <span className="ml-3 shrink-0 text-emerald-300">{confidence}%</span>
                  </div>
                  <Progress value={confidence} className="h-2 bg-slate-800" />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-slate-400">
            Upload an image to view Rekognition labels here, or upload a document to view extracted text.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
