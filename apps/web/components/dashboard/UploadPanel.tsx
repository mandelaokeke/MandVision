

import type { ChangeEvent } from "react";
import { CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UploadPanel({
  uploading,
  hasFile,
  onFileChange,
  onUpload,
}: {
  uploading: boolean;
  hasFile: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
}) {
  return (
    <div className="space-y-6">
      <label className="group flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-500/70 bg-[#0d131c] p-8 text-center transition hover:border-emerald-400/70 hover:bg-emerald-400/[0.03]">
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={onFileChange}
          className="hidden"
        />
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400 ring-1 ring-emerald-400/20">
          <CloudUpload className="h-8 w-8" />
        </div>
        <p className="text-lg font-semibold text-white">
          Drag & drop an image here
        </p>
        <p className="text-slate-300">or click to browse</p>
        <p className="mt-5 text-sm text-slate-500">
          Supported formats: JPG, JPEG, PNG
        </p>
      </label>

      <Button
        onClick={onUpload}
        disabled={uploading || !hasFile}
        className="h-14 w-full rounded-2xl bg-emerald-500 text-base font-bold text-[#04100a] shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
      >
        {uploading ? "Uploading..." : "Upload Image"}
      </Button>
    </div>
  );
}