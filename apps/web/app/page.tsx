"use client";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { HistoryCard } from "@/components/dashboard/HistoryCard";
import { MetadataCard } from "@/components/dashboard/MetadataCard";
import { PreviewCard } from "@/components/dashboard/PreviewCard";
import { ResultsCard } from "@/components/dashboard/ResultsCard";
import { StatusAlert } from "@/components/dashboard/StatusAlert";
import { UploadPanel } from "@/components/dashboard/UploadPanel";
import { useUpload } from "@/hooks/useUpload";

export default function Home() {
  const upload = useUpload();

  return (
    <main className="min-h-screen bg-[#070b10] text-white">
      <DashboardHeader />

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <UploadPanel
            uploading={upload.uploading}
            hasFile={Boolean(upload.file)}
            onFileChange={upload.handleFileChange}
            onUpload={upload.handleUpload}
          />

          <PreviewCard
            fileName={upload.file?.name}
            previewUrl={upload.previewUrl}
            stage={upload.stage}
            progressLabel={upload.progressLabel}
            uploadedAt={upload.metadata?.uploadedAt}
          />

          <StatusAlert stage={upload.stage} status={upload.status} />
        </div>

        <div className="space-y-6">
          <ResultsCard result={upload.result} />
          <HistoryCard items={upload.history} />
          <MetadataCard
            metadata={upload.metadata}
            fileName={upload.file?.name}
            fileSize={upload.file?.size}
            stage={upload.stage}
            progressLabel={upload.progressLabel}
          />
        </div>
      </section>
    </main>
  );
}