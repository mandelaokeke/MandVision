"use client";

import Link from "next/link";
import { Bot, Images, Upload } from "lucide-react";
import { AnalyticsDashboard } from "@/components/dashboard/AnalyticsDashboard";
import { AuthPanel } from "@/components/dashboard/AuthPanel";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

const actionCards = [
  {
    href: "/upload",
    title: "Upload Media",
    icon: Upload,
  },
  {
    href: "/library",
    title: "Manage Library",
    icon: Images,
  },
  {
    href: "/ask",
    title: "Ask AI",
    icon: Bot,
  },
];

export default function DashboardPage() {
  const { session, dashboardItems, setHistoryFilter } = useDashboard();
  const recentItems = dashboardItems.slice(0, 4);

  return (
    <div className="pb-10">
      <AuthPanel
        user={session.user}
        onSignIn={session.signIn}
        onSignOut={session.signOut}
        onDeleteAccount={session.deleteAccount}
      />

      <AnalyticsDashboard items={dashboardItems} onLabelSelect={setHistoryFilter} />

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(360px,0.45fr)]">
        <div className="rounded-2xl border border-white/10 bg-[#0d131c] p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">Quick Links</h2>
            <p className="text-sm text-slate-400">Jump into the main MandVision workflows.</p>
          </div>
          <div className="flex flex-wrap gap-3">
          {actionCards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.href}
                href={card.href}
                title={card.title}
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-400/20"
              >
                <Icon className="h-5 w-5" />
                <span className="sr-only">{card.title}</span>
              </Link>
            );
          })}
          </div>
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#0d131c] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent Uploads</h2>
              <p className="text-sm text-slate-400">Latest processed or queued items.</p>
            </div>
            <Link
              href="/library"
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:border-emerald-400/30 hover:text-emerald-200"
            >
              View Library
            </Link>
          </div>

          {recentItems.length ? (
            <div className="space-y-3">
              {recentItems.map((item) => (
                <div
                  key={item.fileId}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <p className="truncate text-sm font-medium text-slate-100">
                    {item.originalFileName || item.fileId}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.mediaType || "media"} · {item.status || "pending"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-slate-400">
              No uploads found yet.
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
