"use client";

import { CalendarDays, DollarSign, Hash, Mail, Phone } from "lucide-react";
import type { ComponentType } from "react";
import type { DocumentInsights } from "@/hooks/useUpload";

export function DocumentInsightsPanel({
  insights,
}: {
  insights?: DocumentInsights;
}) {
  const groups = [
    { label: "Emails", values: insights?.emails || [], icon: Mail },
    { label: "Phone", values: insights?.phoneNumbers || [], icon: Phone },
    { label: "Dates", values: insights?.dates || [], icon: CalendarDays },
    { label: "Amounts", values: insights?.amounts || [], icon: DollarSign },
    { label: "IDs", values: insights?.identifiers || [], icon: Hash },
  ];
  const hasInsights = groups.some((group) => group.values.length > 0);

  if (!hasInsights) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
        No key document details detected yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) =>
        group.values.length > 0 ? (
          <InsightGroup
            key={group.label}
            label={group.label}
            values={group.values}
            icon={group.icon}
          />
        ) : null
      )}
    </div>
  );
}

function InsightGroup({
  label,
  values,
  icon: Icon,
}: {
  label: string;
  values: string[];
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
        <Icon className="h-3.5 w-3.5 text-emerald-300" />
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={`${label}-${value}`}
            className="max-w-full rounded-lg border border-white/5 bg-slate-950/50 px-3 py-2 text-sm leading-5 text-slate-200"
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}
