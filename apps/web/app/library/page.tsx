"use client";

import { HistoryCard } from "@/components/dashboard/HistoryCard";
import { MetadataCard } from "@/components/dashboard/MetadataCard";
import { PreviewCard } from "@/components/dashboard/PreviewCard";
import { ResultsCard } from "@/components/dashboard/ResultsCard";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

export default function LibraryPage() {
  const {
    upload,
    dashboardItems,
    visibleActiveItem,
    visibleMetadata,
    historyFilter,
    setHistoryFilter,
    setDetailsOpen,
  } = useDashboard();

  return (
    <div className="mx-auto grid max-w-[92rem] items-start gap-8 px-6 py-8 xl:grid-cols-[minmax(420px,0.85fr)_minmax(0,1.15fr)]">
      <section className="min-w-0 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Library</h1>
          <p className="mt-1 text-sm text-slate-400">
            Search, filter, favorite, export, reprocess, and manage uploaded media.
          </p>
        </div>

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
      </section>

      <aside className="min-w-0 space-y-6 xl:sticky xl:top-6">
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

        <PreviewCard
          fileName={
            visibleActiveItem?.originalFileName ||
            visibleMetadata?.fileName ||
            upload.file?.name
          }
          previewUrl={upload.previewUrl}
          stage={upload.stage}
          progressLabel={visibleActiveItem?.status || upload.progressLabel}
          uploadedAt={visibleActiveItem?.uploadedAt || upload.metadata?.uploadedAt}
          historicalSelected={Boolean(visibleActiveItem)}
          previewLoading={upload.fetchingPreview}
          mediaType={
            (visibleActiveItem ?? visibleMetadata)?.mediaType ??
            (upload.file?.type.startsWith("image/")
              ? "image"
              : upload.file
              ? "document"
              : undefined)
          }
          fileType={(visibleActiveItem ?? visibleMetadata)?.fileType ?? upload.file?.type}
          textPreview={visibleActiveItem?.textPreview}
        />

        <MetadataCard
          metadata={visibleActiveItem ?? visibleMetadata}
          fileName={upload.file?.name}
          fileSize={upload.file?.size}
          stage={upload.stage}
          progressLabel={upload.progressLabel}
        />
        <ResultsCard result={visibleActiveItem} />
      </aside>
    </div>
  );
}
