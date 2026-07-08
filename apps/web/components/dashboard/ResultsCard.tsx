import { Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { MediaResult } from "@/hooks/useUpload";

export function ResultsCard({ result }: { result: MediaResult | null }) {
  const labels = result?.labels || [];

  return (
    <Card className="rounded-2xl border-white/10 bg-[#0d131c] text-white shadow-2xl shadow-black/20">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-emerald-300">
          <Eye className="h-5 w-5" />
        </div>
        <div>
          <CardTitle className="text-xl">Detected Objects</CardTitle>
          <p className="text-sm text-slate-400">
            Objects identified in your image by Amazon Rekognition
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {labels.length > 0 ? (
          labels.slice(0, 10).map((label) => {
            const confidence = Math.round(label.confidence || 0);

            return (
              <div
                key={`${label.name}-${label.confidence}`}
                className="rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-200">{label.name}</span>
                  <span className="text-emerald-300">{confidence}%</span>
                </div>
                <Progress value={confidence} className="h-2 bg-slate-800" />
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-slate-400">
            Upload an image to view Rekognition labels here.
          </div>
        )}
      </CardContent>
    </Card>
  );
}