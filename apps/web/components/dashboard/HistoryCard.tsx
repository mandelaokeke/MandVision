"use client";

import {
  Clock3,
  Download,
  Filter,
  Grid2X2,
  Images,
  List,
  RotateCcw,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MediaResult } from "@/hooks/useUpload";

type DateFilter = "all" | "today" | "7d" | "30d";
type FavoriteFilter = "all" | "favorites";
type ViewMode = "list" | "gallery";

function formatDate(value?: string) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function HistoryCard({
  items,
  selectedFileId,
  onSelectItem,
  onDeleteItem,
  deletingFileId,
  onReprocessItem,
  reprocessingFileId,
  favoriteFileIds,
  onToggleFavorite,
  filterTerm,
  onFilterTermChange,
}: {
  items: MediaResult[];
  selectedFileId?: string;
  onSelectItem: (item: MediaResult) => void;
  onDeleteItem?: (item: MediaResult) => void;
  deletingFileId?: string | null;
  onReprocessItem?: (item: MediaResult) => void;
  reprocessingFileId?: string | null;
  favoriteFileIds?: string[];
  onToggleFavorite?: (item: MediaResult) => void;
  filterTerm: string;
  onFilterTermChange: (term: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [labelFilter, setLabelFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [favoriteFilter, setFavoriteFilter] = useState<FavoriteFilter>("all");
  const [minimumConfidence, setMinimumConfidence] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const favoriteSet = useMemo(() => new Set(favoriteFileIds || []), [favoriteFileIds]);

  const statusOptions = useMemo(() => {
    return Array.from(
      new Set(items.map((item) => item.status).filter((status): status is string => Boolean(status)))
    ).sort((first, second) => first.localeCompare(second));
  }, [items]);

  const labelOptions = useMemo(() => {
    return Array.from(
      new Set(
        items.flatMap((item) =>
          (item.labels || [])
            .map((label) => label.name?.trim())
            .filter((name): name is string => Boolean(name))
        )
      )
    ).sort((first, second) => first.localeCompare(second));
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = filterTerm.trim().toLowerCase();

    return items.filter((item) => {
      const fileName = item.originalFileName?.toLowerCase() || "";
      const labels = item.labels?.map((label) => label.name?.toLowerCase()).join(" ") || "";
      const hasQueryMatch = !query || fileName.includes(query) || labels.includes(query);
      const hasStatusMatch = statusFilter === "all" || item.status === statusFilter;
      const hasLabelMatch =
        labelFilter === "all" || item.labels?.some((label) => label.name === labelFilter);
      const hasConfidenceMatch =
        minimumConfidence === 0 ||
        item.labels?.some((label) => (label.confidence || 0) >= minimumConfidence);
      const hasDateMatch = matchesDateFilter(item, dateFilter);
      const hasFavoriteMatch =
        favoriteFilter === "all" || favoriteSet.has(item.fileId);

      return (
        hasQueryMatch &&
        hasStatusMatch &&
        hasLabelMatch &&
        hasConfidenceMatch &&
        hasDateMatch &&
        hasFavoriteMatch
      );
    });
  }, [
    items,
    filterTerm,
    statusFilter,
    labelFilter,
    minimumConfidence,
    dateFilter,
    favoriteFilter,
    favoriteSet,
  ]);

  const hasAdvancedFilters =
    statusFilter !== "all" ||
    labelFilter !== "all" ||
    dateFilter !== "all" ||
    favoriteFilter !== "all" ||
    minimumConfidence > 0;
  const visibleItems = filterTerm || hasAdvancedFilters || showAll ? filteredItems : filteredItems.slice(0, 3);
  const hiddenCount = Math.max(filteredItems.length - visibleItems.length, 0);
  const totalCount = items.length;
  const processedCount = items.filter((item) => isProcessed(item)).length;
  const pendingCount = Math.max(totalCount - processedCount, 0);
  const favoriteCount = items.filter((item) => favoriteSet.has(item.fileId)).length;

  function resetFilters() {
    onFilterTermChange("");
    setStatusFilter("all");
    setLabelFilter("all");
    setDateFilter("all");
    setFavoriteFilter("all");
    setMinimumConfidence(0);
    setShowAll(false);
  }

  function exportFilteredItems() {
    if (!filteredItems.length) return;

    const csv = buildHistoryCsv(filteredItems, favoriteSet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `mandvision-history-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d131c] text-white shadow-2xl shadow-black/20">
      <div className="space-y-4 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-emerald-300">
            <Images className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight">Upload History</h2>
            <p className="text-sm text-slate-400">
              {totalCount} images • {processedCount} processed • {pendingCount} pending • {favoriteCount} favorites
            </p>
          </div>
          <div className="flex rounded-lg border border-white/10 bg-black/20 p-1">
            <ViewModeButton
              active={viewMode === "list"}
              label="List"
              icon={List}
              onClick={() => setViewMode("list")}
            />
            <ViewModeButton
              active={viewMode === "gallery"}
              label="Gallery"
              icon={Grid2X2}
              onClick={() => setViewMode("gallery")}
            />
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={filterTerm}
            onChange={(event) => {
              onFilterTermChange(event.target.value);
              setShowAll(true);
            }}
            placeholder="Search by file name or label..."
            className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 pl-9 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setFiltersOpen((current) => !current)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-200 transition hover:text-white"
            >
              <Filter className="h-4 w-4 text-emerald-300" />
              Advanced Filters
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs font-medium text-slate-400">
                {filtersOpen ? "Hide" : "Show"}
              </span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportFilteredItems}
                disabled={!filteredItems.length}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={resetFilters}
                disabled={!filterTerm && !hasAdvancedFilters}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-emerald-400/30 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          </div>

          {filtersOpen ? (
            <div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FilterSelect
                  label="Status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: "all", label: "All statuses" },
                    ...statusOptions.map((status) => ({ value: status, label: status })),
                  ]}
                />
                <FilterSelect
                  label="Label"
                  value={labelFilter}
                  onChange={setLabelFilter}
                  options={[
                    { value: "all", label: "All labels" },
                    ...labelOptions.map((label) => ({ value: label, label })),
                  ]}
                />
                <FilterSelect
                  label="Upload Date"
                  value={dateFilter}
                  onChange={(value) => setDateFilter(value as DateFilter)}
                  options={[
                    { value: "all", label: "Any time" },
                    { value: "today", label: "Today" },
                    { value: "7d", label: "Last 7 days" },
                    { value: "30d", label: "Last 30 days" },
                  ]}
                />
                <FilterSelect
                  label="Favorites"
                  value={favoriteFilter}
                  onChange={(value) => setFavoriteFilter(value as FavoriteFilter)}
                  options={[
                    { value: "all", label: "All images" },
                    { value: "favorites", label: "Favorites only" },
                  ]}
                />
              </div>

              <label className="mt-4 block">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-slate-400">
                  <span>Minimum Confidence</span>
                  <span className="text-emerald-300">{minimumConfidence}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={minimumConfidence}
                  onChange={(event) => setMinimumConfidence(Number(event.target.value))}
                  className="h-2 w-full accent-emerald-400"
                />
              </label>
            </div>
          ) : hasAdvancedFilters ? (
            <p className="text-xs text-slate-400">
              Advanced filters are active. Open filters to adjust them or reset to clear.
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 p-6 pt-0">
        {filteredItems.length > 0 ? (
          <>
            {viewMode === "list" ? (
              <div className="space-y-4">
                {visibleItems.map((item) => (
                  <HistoryListItem
                    key={item.fileId}
                    item={item}
                    selected={item.fileId === selectedFileId}
                    favorite={favoriteSet.has(item.fileId)}
                    deleting={deletingFileId === item.fileId}
                    reprocessing={reprocessingFileId === item.fileId}
                    onSelectItem={onSelectItem}
                    onToggleFavorite={onToggleFavorite}
                    onDeleteItem={onDeleteItem}
                    onReprocessItem={onReprocessItem}
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleItems.map((item) => (
                  <HistoryGalleryItem
                    key={item.fileId}
                    item={item}
                    selected={item.fileId === selectedFileId}
                    favorite={favoriteSet.has(item.fileId)}
                    deleting={deletingFileId === item.fileId}
                    reprocessing={reprocessingFileId === item.fileId}
                    onSelectItem={onSelectItem}
                    onToggleFavorite={onToggleFavorite}
                    onDeleteItem={onDeleteItem}
                    onReprocessItem={onReprocessItem}
                  />
                ))}
              </div>
            )}
            <>
              {hiddenCount > 0 || showAll ? (
                <button
                  type="button"
                  onClick={() => setShowAll((current) => !current)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.04]"
                >
                  {showAll ? "Show less" : `Show all ${filteredItems.length} uploads`}
                </button>
              ) : null}
            </>
          </>
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-slate-400">
            {items.length > 0 ? "No uploads match the current filters." : "No uploads found yet."}
          </div>
        )}
      </div>
    </div>
  );
}

function ViewModeButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: typeof List;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${label} view`}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-md transition ${
        active
          ? "bg-emerald-400/15 text-emerald-300"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function HistoryListItem({
  item,
  selected,
  favorite,
  deleting,
  reprocessing,
  onSelectItem,
  onToggleFavorite,
  onDeleteItem,
  onReprocessItem,
}: {
  item: MediaResult;
  selected: boolean;
  favorite: boolean;
  deleting: boolean;
  reprocessing: boolean;
  onSelectItem: (item: MediaResult) => void;
  onToggleFavorite?: (item: MediaResult) => void;
  onDeleteItem?: (item: MediaResult) => void;
  onReprocessItem?: (item: MediaResult) => void;
}) {
  const topLabels = item.labels?.slice(0, 3) || [];

  return (
    <div
      className={`flex items-stretch gap-2 rounded-xl border p-2 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.03] ${
        selected ? "border-emerald-400/50 bg-emerald-400/[0.06]" : "border-white/10 bg-black/20"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelectItem(item)}
        className="min-w-0 flex-1 rounded-lg p-2 text-left"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-100">
              {item.originalFileName || item.fileId}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <Clock3 className="h-3.5 w-3.5" />
              <span>{formatDate(item.processedAt || item.uploadedAt)}</span>
            </div>
          </div>

          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            {item.status || "UNKNOWN"}
          </span>
        </div>

        <LabelPills item={item} labels={topLabels} />
      </button>

      <HistoryItemActions
        item={item}
        favorite={favorite}
        deleting={deleting}
        reprocessing={reprocessing}
        onToggleFavorite={onToggleFavorite}
        onDeleteItem={onDeleteItem}
        onReprocessItem={onReprocessItem}
      />
    </div>
  );
}

function HistoryGalleryItem({
  item,
  selected,
  favorite,
  deleting,
  reprocessing,
  onSelectItem,
  onToggleFavorite,
  onDeleteItem,
  onReprocessItem,
}: {
  item: MediaResult;
  selected: boolean;
  favorite: boolean;
  deleting: boolean;
  reprocessing: boolean;
  onSelectItem: (item: MediaResult) => void;
  onToggleFavorite?: (item: MediaResult) => void;
  onDeleteItem?: (item: MediaResult) => void;
  onReprocessItem?: (item: MediaResult) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const topLabels = item.labels?.slice(0, 2) || [];

  useEffect(() => {
    let cancelled = false;

    async function fetchThumbnail() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;

        if (!apiUrl) {
          setLoading(false);
          setAvailable(false);
          return;
        }

        setLoading(true);
        setAvailable(true);

        const response = await fetch(`${apiUrl}/media/${item.fileId}/preview-url`);

        if (!response.ok) {
          if (!cancelled) {
            setPreviewUrl(null);
            setAvailable(false);
          }
          return;
        }

        const data = (await response.json()) as { previewUrl?: string };

        if (!cancelled) {
          setPreviewUrl(data.previewUrl || null);
          setAvailable(Boolean(data.previewUrl));
        }
      } catch (error) {
        console.error("Could not fetch gallery thumbnail", error);

        if (!cancelled) {
          setPreviewUrl(null);
          setAvailable(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchThumbnail();

    return () => {
      cancelled = true;
    };
  }, [item.fileId]);

  return (
    <div
      className={`overflow-hidden rounded-xl border transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.03] ${
        selected ? "border-emerald-400/50 bg-emerald-400/[0.06]" : "border-white/10 bg-black/20"
      }`}
    >
      <button type="button" onClick={() => onSelectItem(item)} className="block w-full text-left">
        <div
          className="flex aspect-[4/3] items-center justify-center bg-slate-950 bg-cover bg-center text-sm text-slate-500"
          style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
        >
          {loading ? "Loading preview..." : available ? null : "Preview unavailable"}
        </div>
        <div className="space-y-3 p-4">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-100">
              {item.originalFileName || item.fileId}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <Clock3 className="h-3.5 w-3.5" />
              <span>{formatDate(item.processedAt || item.uploadedAt)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              {item.status || "UNKNOWN"}
            </span>
            <span className="text-xs text-slate-500">{item.labels?.length || 0} labels</span>
          </div>
          <LabelPills item={item} labels={topLabels} />
        </div>
      </button>

      <div className="flex gap-2 border-t border-white/10 p-3">
        <HistoryItemActions
          item={item}
          favorite={favorite}
          deleting={deleting}
          reprocessing={reprocessing}
          onToggleFavorite={onToggleFavorite}
          onDeleteItem={onDeleteItem}
          onReprocessItem={onReprocessItem}
          horizontal
        />
      </div>
    </div>
  );
}

function LabelPills({
  item,
  labels,
}: {
  item: MediaResult;
  labels: NonNullable<MediaResult["labels"]>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {labels.length > 0 ? (
        labels.map((label) => (
          <span
            key={`${item.fileId}-${label.name}`}
            className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs text-slate-300"
          >
            {label.name} {label.confidence ? `${Math.round(label.confidence)}%` : ""}
          </span>
        ))
      ) : (
        <span className="text-xs text-slate-500">No labels available</span>
      )}
    </div>
  );
}

function HistoryItemActions({
  item,
  favorite,
  deleting,
  reprocessing,
  onToggleFavorite,
  onDeleteItem,
  onReprocessItem,
  horizontal = false,
}: {
  item: MediaResult;
  favorite: boolean;
  deleting: boolean;
  reprocessing: boolean;
  onToggleFavorite?: (item: MediaResult) => void;
  onDeleteItem?: (item: MediaResult) => void;
  onReprocessItem?: (item: MediaResult) => void;
  horizontal?: boolean;
}) {
  const canReprocess = item.status !== "PROCESSED";

  return (
    <div className={horizontal ? "flex flex-1 gap-2" : "flex w-11 shrink-0 flex-col gap-2"}>
      {onReprocessItem && canReprocess ? (
        <button
          type="button"
          aria-label={`Reprocess ${item.originalFileName || item.fileId}`}
          disabled={reprocessing}
          onClick={() => onReprocessItem(item)}
          className={`flex h-11 items-center justify-center rounded-lg border border-emerald-400/20 text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50 ${
            horizontal ? "flex-1" : ""
          }`}
        >
          <RotateCcw className={`h-4 w-4 ${reprocessing ? "animate-spin" : ""}`} />
        </button>
      ) : null}

      {onToggleFavorite ? (
        <button
          type="button"
          aria-label={`${favorite ? "Remove" : "Add"} ${item.originalFileName || item.fileId} ${favorite ? "from" : "to"} favorites`}
          onClick={() => onToggleFavorite(item)}
          className={`flex h-11 items-center justify-center rounded-lg border transition ${
            horizontal ? "flex-1" : ""
          } ${
            favorite
              ? "border-amber-300/50 bg-amber-300/10 text-amber-300"
              : "border-white/10 text-slate-400 hover:border-amber-300/40 hover:bg-amber-300/10 hover:text-amber-300"
          }`}
        >
          <Star className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
        </button>
      ) : null}

      {onDeleteItem ? (
        <button
          type="button"
          aria-label={`Delete ${item.originalFileName || item.fileId}`}
          disabled={deleting}
          onClick={() => onDeleteItem(item)}
          className={`flex h-11 items-center justify-center rounded-lg border border-red-400/20 text-red-300 transition hover:border-red-400/50 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50 ${
            horizontal ? "flex-1" : ""
          }`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-white/10 bg-[#0d131c] px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function isProcessed(item: MediaResult) {
  return item.status === "PROCESSED" || Boolean(item.labels?.length);
}

function matchesDateFilter(item: MediaResult, filter: DateFilter) {
  if (filter === "all") return true;

  const value = item.uploadedAt || item.processedAt;
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (filter === "today") {
    return date >= start;
  }

  const days = filter === "7d" ? 7 : 30;
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);

  return date >= cutoff;
}

function buildHistoryCsv(items: MediaResult[], favoriteSet: Set<string>) {
  const rows = items.flatMap((item) => {
    const labels = item.labels?.length ? item.labels : [{ name: "", confidence: undefined }];

    return labels.map((label) => ({
      fileId: item.fileId,
      originalFileName: item.originalFileName || "",
      status: item.status || "",
      uploadedAt: item.uploadedAt || "",
      processedAt: item.processedAt || "",
      bucket: item.bucket || "",
      objectKey: item.objectKey || "",
      fileSize: item.fileSize?.toString() || "",
      favorite: favoriteSet.has(item.fileId) ? "yes" : "no",
      labelName: label.name || "",
      labelConfidence:
        typeof label.confidence === "number" ? label.confidence.toFixed(2) : "",
    }));
  });

  const headers = [
    "fileId",
    "originalFileName",
    "status",
    "uploadedAt",
    "processedAt",
    "bucket",
    "objectKey",
    "fileSize",
    "favorite",
    "labelName",
    "labelConfidence",
  ];

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header as keyof typeof row])).join(",")),
  ].join("\n");
}

function escapeCsvCell(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }

  return value;
}
