import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UploadStage } from "@/hooks/useUpload";
import { ProcessingTimeline } from "./ProcessingTimeline";

export function PreviewCard({
  fileName,
  previewUrl,
  stage,
  progressLabel,
  uploadedAt,
}: {
  fileName?: string;
  previewUrl: string | null;
  stage: UploadStage;
  progressLabel: string;
  uploadedAt?: string;
}) {
  return (
    <Card className="rounded-2xl border-white/10 bg-[#0d131c] text-white shadow-2xl shadow-black/20">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="truncate text-base text-slate-100">
          {fileName || "No image selected"}
        </CardTitle>
        <Badge className="border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/10">
          {progressLabel}
        </Badge>
      </CardHeader>

      <CardContent>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Selected upload preview"
              className="h-80 w-full object-cover"
            />
          ) : (
            <div className="flex h-80 items-center justify-center text-slate-500">
              Image preview will appear here
            </div>
          )}
        </div>

        <ProcessingTimeline stage={stage} uploadedAt={uploadedAt} />
      </CardContent>
    </Card>
  );
}