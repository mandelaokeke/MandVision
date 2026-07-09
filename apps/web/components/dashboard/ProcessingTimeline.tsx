

import { CheckCircle2, CircleDashed, UploadCloud } from "lucide-react";
import type { UploadStage } from "@/hooks/useUpload";

function getStepStyles(active: boolean) {
  return active
    ? "border-emerald-400 bg-emerald-400/10 text-emerald-300"
    : "border-slate-700 bg-slate-900 text-slate-500";
}

export function ProcessingTimeline({
  stage,
  uploadedAt,
}: {
  stage: UploadStage;
  uploadedAt?: string;
}) {
  const uploaded = Boolean(uploadedAt);
  const processing = stage === "processing" || stage === "complete";
  const complete = stage === "complete";

  const time = uploadedAt
    ? new Intl.DateTimeFormat("en", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(uploadedAt))
    : "—";

  const steps = [
    { label: "Uploaded", value: time, active: uploaded, icon: UploadCloud },
    {
      label: "Processing",
      value: processing ? "Queued" : "—",
      active: processing,
      icon: CircleDashed,
    },
    {
      label: "Complete",
      value: complete ? "Ready" : "—",
      active: complete,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="mt-5 grid grid-cols-3 items-center gap-3 text-center text-sm">
      {steps.map((step) => {
        const Icon = step.icon;

        return (
          <div
            key={step.label}
            className={step.active ? "text-emerald-300" : "text-slate-500"}
          >
            <div
              className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border ${getStepStyles(
                step.active
              )}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <p className="font-semibold">{step.label}</p>
            <p className="mt-1 text-xs">{step.value}</p>
          </div>
        );
      })}
    </div>
  );
}