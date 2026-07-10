"use client";

import Link from "next/link";
import { DocumentAssistantCard } from "@/components/dashboard/DocumentAssistantCard";
import { MetadataCard } from "@/components/dashboard/MetadataCard";
import { ResultsCard } from "@/components/dashboard/ResultsCard";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

export default function AskPage() {
  const {
    upload,
    dashboardItems,
    visibleActiveItem,
    visibleMetadata,
    setHistoryFilter,
  } = useDashboard();

  return (
    <div className="pb-10">
      <section className="mx-auto flex max-w-7xl flex-col gap-3 px-6 pt-8 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Ask AI</h1>
          <p className="mt-1 text-sm text-slate-400">
            Ask questions across extracted document text, summaries, and detected details.
          </p>
        </div>
        <Link
          href="/library"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-medium text-slate-300 transition hover:border-emerald-400/30 hover:text-emerald-200"
        >
          Choose from Library
        </Link>
      </section>

      <DocumentAssistantCard
        items={dashboardItems}
        selectedItem={visibleActiveItem}
        onSelectItem={upload.selectHistoryItem}
        onFilterTermChange={setHistoryFilter}
      />

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-2">
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
