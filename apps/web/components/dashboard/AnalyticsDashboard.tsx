"use client";

import {
  BarChart3,
  Boxes,
  CalendarDays,
  FileText,
  ImageIcon,
  Star,
} from "lucide-react";
import type { ComponentType } from "react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MediaResult } from "@/hooks/useUpload";

type LabelSummary = {
  name: string;
  count: number;
};

type ActivityPoint = {
  label: string;
  count: number;
};

const numberFormatter = new Intl.NumberFormat("en");
export function AnalyticsDashboard({
  items,
  onLabelSelect,
}: {
  items: MediaResult[];
  onLabelSelect?: (label: string) => void;
}) {
  const [showAllLabels, setShowAllLabels] = useState(false);
  const analytics = buildAnalytics(items);
  const maxLabelCount = Math.max(...analytics.topLabels.map((label) => label.count), 1);
  const maxActivityCount = Math.max(...analytics.activity.map((point) => point.count), 1);
  const hasData = analytics.totalFiles > 0;
  const visibleLabels = showAllLabels ? analytics.topLabels : analytics.topLabels.slice(0, 5);

  return (
    <section className="mx-auto max-w-7xl space-y-5 px-6 pt-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300/80">
            Analytics
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
            File Intelligence Dashboard
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Overview of your image recognition and document extraction activity.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0d131c] px-4 py-3 text-sm text-slate-300">
          {analytics.processedToday} processed today
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Files Processed"
          value={numberFormatter.format(analytics.totalFiles)}
          detail={`${numberFormatter.format(analytics.processedFiles)} completed`}
          icon={ImageIcon}
        />
        <MetricCard
          title="Objects Detected"
          value={numberFormatter.format(analytics.totalObjects)}
          detail={`${numberFormatter.format(analytics.uniqueLabels)} unique labels`}
          icon={Boxes}
        />
        <MetricCard
          title="Documents Extracted"
          value={numberFormatter.format(analytics.extractedDocuments)}
          detail={`${numberFormatter.format(analytics.totalDocumentWords)} words indexed`}
          icon={FileText}
        />
        <MetricCard
          title="Top Detected Label"
          value={analytics.topLabel?.name || "None yet"}
          detail={
            analytics.topLabel
              ? `${numberFormatter.format(analytics.topLabel.count)} detections`
              : "Upload images to start"
          }
          icon={Star}
          onClick={analytics.topLabel ? () => onLabelSelect?.(analytics.topLabel.name) : undefined}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-2xl border-white/10 bg-[#0d131c] text-white shadow-2xl shadow-black/20">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
            <div className="flex min-w-0 gap-4">
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-emerald-300">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Top Detected Labels</CardTitle>
              <p className="text-sm text-slate-400">
                Most common Rekognition labels across your uploads
              </p>
            </div>
            </div>
            {analytics.topLabels.length > 5 ? (
              <button
                type="button"
                onClick={() => setShowAllLabels((current) => !current)}
                className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-emerald-400/30 hover:text-emerald-200"
              >
                {showAllLabels ? "View less" : "View more"}
              </button>
            ) : null}
          </CardHeader>
          <CardContent className="pt-0">
            {analytics.topLabels.length > 0 ? (
              <div className={`${showAllLabels ? "max-h-56 overflow-y-auto pr-2" : ""} space-y-1.5`}>
                {visibleLabels.map((label) => (
                  <button
                    type="button"
                    key={label.name}
                    onClick={() => onLabelSelect?.(label.name)}
                    className="grid w-full grid-cols-[110px_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-emerald-400/[0.04]"
                  >
                    <span className="truncate font-medium text-slate-300">{label.name}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-900">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${(label.count / maxLabelCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-right font-semibold text-slate-100">
                      {numberFormatter.format(label.count)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyAnalyticsState label="No labels have been detected yet." />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/10 bg-[#0d131c] text-white shadow-2xl shadow-black/20">
          <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
            <div className="rounded-xl border border-sky-400/30 bg-sky-400/10 p-3 text-sky-300">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">7-Day Activity</CardTitle>
              <p className="text-sm text-slate-400">
                Recent upload volume
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {hasData ? (
              <div className="flex h-32 items-end gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
                {analytics.activity.map((point) => (
                  <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="flex h-16 w-full items-end">
                      <div
                        className="w-full rounded-t-md bg-emerald-400/80"
                        style={{
                          height: `${Math.max((point.count / maxActivityCount) * 100, point.count ? 10 : 2)}%`,
                        }}
                        title={`${point.count} uploads`}
                      />
                    </div>
                    <span className="w-full truncate text-center text-xs text-slate-500">
                      {point.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyAnalyticsState label="Activity will appear after your first upload." />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  onClick,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  onClick?: () => void;
}) {
  const content = (
    <CardContent className="flex items-center gap-4 p-6">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-400">{title}</p>
        <p className="mt-2 truncate text-3xl font-bold tracking-tight text-white">
          {value}
        </p>
        <p className="mt-1 text-sm text-emerald-300">{detail}</p>
      </div>
    </CardContent>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        <Card className="rounded-2xl border-white/10 bg-[#0d131c] text-white shadow-2xl shadow-black/20 transition hover:border-emerald-400/40 hover:bg-emerald-400/[0.03]">
          {content}
        </Card>
      </button>
    );
  }

  return (
    <Card className="rounded-2xl border-white/10 bg-[#0d131c] text-white shadow-2xl shadow-black/20">
      {content}
    </Card>
  );
}

function EmptyAnalyticsState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-slate-400">
      {label}
    </div>
  );
}

function buildAnalytics(items: MediaResult[]) {
  const now = new Date();
  const todayKey = toDateKey(now);
  const labelCounts = new Map<string, { count: number; confidenceTotal: number }>();
  let totalObjects = 0;

  items.forEach((item) => {
    item.labels?.forEach((label) => {
      const labelName = label.name?.trim();

      if (!labelName) return;

      totalObjects += 1;

      const current = labelCounts.get(labelName) || { count: 0, confidenceTotal: 0 };
      const confidence = typeof label.confidence === "number" ? label.confidence : 0;
      labelCounts.set(labelName, {
        count: current.count + 1,
        confidenceTotal: current.confidenceTotal + confidence,
      });

    });
  });

  const topLabels: LabelSummary[] = Array.from(labelCounts.entries())
    .map(([name, value]) => ({
      name,
      count: value.count,
    }))
    .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name))
    .slice(0, 10);

  const activity = buildActivity(items, now);

  return {
    totalFiles: items.length,
    processedFiles: items.filter((item) => item.status === "PROCESSED" || item.labels?.length).length,
    extractedDocuments: items.filter(
      (item) => item.mediaType === "document" && item.extractionStatus === "COMPLETE"
    ).length,
    totalDocumentWords: items.reduce(
      (total, item) => total + (typeof item.wordCount === "number" ? item.wordCount : 0),
      0
    ),
    processedToday: items.filter((item) => {
      const value = item.processedAt || item.uploadedAt;
      return value ? toDateKey(new Date(value)) === todayKey : false;
    }).length,
    totalObjects,
    uniqueLabels: labelCounts.size,
    topLabel: topLabels[0],
    topLabels,
    activity,
  };
}

function buildActivity(items: MediaResult[], now: Date): ActivityPoint[] {
  const points: ActivityPoint[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);

    const key = toDateKey(date);
    const count = items.filter((item) => {
      const value = item.processedAt || item.uploadedAt;
      return value ? toDateKey(new Date(value)) === key : false;
    }).length;

    points.push({
      label: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date),
      count,
    });
  }

  return points;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
