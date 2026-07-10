"use client";

import { MetadataCard } from "@/components/dashboard/MetadataCard";
import { PreviewCard } from "@/components/dashboard/PreviewCard";
import { ResultsCard } from "@/components/dashboard/ResultsCard";
import { StatusAlert } from "@/components/dashboard/StatusAlert";
import { UploadPanel } from "@/components/dashboard/UploadPanel";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

export default function UploadPage() {
  const { upload, visibleActiveItem, visibleMetadata } = useDashboard();
  const mediaType =
    (visibleActiveItem ?? visibleMetadata)?.mediaType ??
    (upload.file?.type.startsWith("image/")
      ? "image"
      : upload.file
      ? "document"
      : undefined);

  return (
    <div className="mx-auto grid max-w-7xl items-start gap-8 px-6 py-8 lg:grid-cols-[minmax(380px,0.9fr)_minmax(0,1.1fr)]">
      <section className="min-w-0 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Upload</h1>
          <p className="mt-1 text-sm text-slate-400">
            Add images and documents to MandVision for processing.
          </p>
        </div>

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
          historicalSelected={Boolean(upload.selectedHistoryItem)}
          previewLoading={upload.fetchingPreview}
          mediaType={mediaType}
          fileType={(visibleActiveItem ?? visibleMetadata)?.fileType ?? upload.file?.type}
          textPreview={visibleActiveItem?.textPreview}
        />

        <StatusAlert stage={upload.stage} status={upload.status} />
      </section>

      <section className="min-w-0 space-y-6">
        <MetadataCard
          metadata={visibleActiveItem ?? visibleMetadata}
          fileName={upload.file?.name}
          fileSize={upload.file?.size}
          stage={upload.stage}
          progressLabel={upload.progressLabel}
        />
        <ResultsCard result={visibleActiveItem} />
      </section>
    </div>
  );
}
