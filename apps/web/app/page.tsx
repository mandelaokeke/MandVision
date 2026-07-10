"use client";

import { AuthPanel } from "@/components/dashboard/AuthPanel";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DocumentAssistantCard } from "@/components/dashboard/DocumentAssistantCard";
import { HistoryCard } from "@/components/dashboard/HistoryCard";
import { AnalyticsDashboard } from "@/components/dashboard/AnalyticsDashboard";
import { MetadataCard } from "@/components/dashboard/MetadataCard";
import { PreviewCard } from "@/components/dashboard/PreviewCard";
import { ResultsCard } from "@/components/dashboard/ResultsCard";
import { StatusAlert } from "@/components/dashboard/StatusAlert";
import { UploadPanel } from "@/components/dashboard/UploadPanel";
import { useDashboardSession } from "@/hooks/useDashboardSession";
import { useUpload } from "@/hooks/useUpload";
import { ImageDetailsModal } from "@/components/dashboard/ImageDetailsModal";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const session = useDashboardSession();
  const upload = useUpload({ ownerUserId: session.user?.id });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("");
  const uploadSectionRef = useRef<HTMLDivElement | null>(null);
  const dashboardItems = session.user
    ? upload.history.filter((item) => upload.mediaOwners[item.fileId] === session.user?.id)
    : upload.history;
  const activeItem = upload.selectedHistoryItem ?? upload.result;
  const activeItemVisible =
    !activeItem ||
    !session.user ||
    upload.mediaOwners[activeItem.fileId] === session.user.id;
  const visibleActiveItem = activeItemVisible ? activeItem : null;
  const visibleMetadata =
    !upload.metadata ||
    !session.user ||
    upload.mediaOwners[upload.metadata.fileId] === session.user.id
      ? upload.metadata
      : null;

  useEffect(() => {
    function handleNewUpload() {
      uploadSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    window.addEventListener("mandvision:new-upload", handleNewUpload);

    return () => {
      window.removeEventListener("mandvision:new-upload", handleNewUpload);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#070b10] text-white">
      <DashboardHeader />

      <AuthPanel
        user={session.user}
        onSignIn={session.signIn}
        onSignOut={session.signOut}
      />

      <AnalyticsDashboard items={dashboardItems} onLabelSelect={setHistoryFilter} />

      <DocumentAssistantCard
        items={dashboardItems}
        selectedItem={visibleActiveItem}
        onSelectItem={upload.selectHistoryItem}
        onFilterTermChange={setHistoryFilter}
      />

      <section className="mx-auto grid max-w-7xl items-start gap-8 px-6 py-8 lg:grid-cols-[minmax(380px,0.9fr)_minmax(0,1.1fr)]">
        <div ref={uploadSectionRef} className="min-w-0 scroll-mt-6 space-y-6">
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
            mediaType={
              (visibleActiveItem ?? visibleMetadata)?.mediaType ??
              (upload.file?.type.startsWith("image/")
                ? "image"
                : upload.file
                ? "document"
                : undefined)
            }
          />

          <StatusAlert stage={upload.stage} status={upload.status} />
        </div>

        <div className="min-w-0 space-y-6">
          <HistoryCard
            items={dashboardItems}
            selectedFileId={visibleActiveItem?.fileId}
            onSelectItem={upload.selectHistoryItem}
            onDeleteItem={upload.deleteMediaItem}
            deletingFileId={upload.deletingFileId}
            onReprocessItem={upload.reprocessMediaItem}
            reprocessingFileId={upload.reprocessingFileId}
            onReprocessPending={upload.reprocessPendingItems}
            reprocessingPending={upload.reprocessingPending}
            onRefresh={upload.fetchHistory}
            refreshing={upload.refreshingHistory}
            favoriteFileIds={upload.favoriteFileIds}
            onToggleFavorite={upload.toggleFavoriteItem}
            filterTerm={historyFilter}
            onFilterTermChange={setHistoryFilter}
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!visibleActiveItem}
              onClick={() => setDetailsOpen(true)}
              className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              View Details
            </button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 pb-8">
        <MetadataCard
          metadata={visibleActiveItem ?? visibleMetadata}
          fileName={upload.file?.name}
          fileSize={upload.file?.size}
          stage={upload.stage}
          progressLabel={upload.progressLabel}
        />
      </section>
      <section className="mx-auto max-w-7xl px-6 pb-8">
        <ResultsCard result={visibleActiveItem} />
      </section>
      <ImageDetailsModal
        open={detailsOpen}
        item={visibleActiveItem}
        onClose={() => setDetailsOpen(false)}
        onDelete={upload.deleteMediaItem}
        deleting={
          upload.deletingFileId ===
          visibleActiveItem?.fileId
        }
        onReprocess={upload.reprocessMediaItem}
        reprocessing={
          upload.reprocessingFileId ===
          visibleActiveItem?.fileId
        }
        favorite={upload.favoriteFileIds.includes(
          visibleActiveItem?.fileId || ""
        )}
        onToggleFavorite={upload.toggleFavoriteItem}
      />
    </main>
  );
}
