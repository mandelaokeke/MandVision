import type { UploadStage } from "@/hooks/useUpload";

export function StatusAlert({ stage, status }: { stage: UploadStage; status: string }) {
  if (!status) return null;

  const isError = stage === "error";

  return (
    <div
      className={`rounded-2xl border p-5 text-sm ${
        isError
          ? "border-red-400/20 bg-red-400/10 text-red-50"
          : "border-emerald-400/20 bg-emerald-400/10 text-emerald-50"
      }`}
    >
      <p className="font-semibold">{isError ? "Upload Issue" : "Processing Status"}</p>
      <p className="mt-1 text-slate-300">{status}</p>
    </div>
  );
}