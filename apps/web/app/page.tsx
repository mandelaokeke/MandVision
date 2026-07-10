"use client";

import Link from "next/link";
import { useState } from "react";
import { Bot, ChevronDown, Images, Upload } from "lucide-react";
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
    title: "VisoAI",
    icon: Bot,
  },
];

const faqs = [
  {
    question: "What can I upload?",
    answer:
      "Images, PDFs, DOC, and DOCX files. Images are analyzed for labels, while documents are extracted into searchable text.",
  },
  {
    question: "Where do processed files go?",
    answer:
      "Everything lands in Library, where you can preview files, filter results, favorite important uploads, export CSVs, download originals, and delete items.",
  },
  {
    question: "What does VisoAI do?",
    answer:
      "VisoAI is the chat shortcut for your processed documents. Ask for summaries, compare documents, search for emails or IDs, or ask how MandVision works.",
  },
  {
    question: "Can I search inside documents?",
    answer:
      "Yes. Once a PDF or Word document is processed, MandVision indexes the extracted text so Library search and VisoAI can find details inside it.",
  },
  {
    question: "Can I manage old uploads?",
    answer:
      "Yes. Library lets you reprocess pending documents, mark favorites, download originals, export history, and remove uploads you no longer need.",
  },
  {
    question: "Do I need to sign in first?",
    answer:
      "You can browse the general dashboard first. Signing in switches MandVision to your own uploads, analytics, and document history.",
  },
];

export default function DashboardPage() {
  const { session, dashboardItems, setHistoryFilter } = useDashboard();
  const recentItems = dashboardItems.slice(0, 4);
  const [expandedFaqs, setExpandedFaqs] = useState<Set<string>>(new Set());
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const visibleFaqs = showAllFaqs ? faqs : faqs.slice(0, 3);

  function toggleFaq(question: string) {
    setExpandedFaqs((current) => {
      const next = new Set(current);
      if (next.has(question)) {
        next.delete(question);
      } else {
        next.add(question);
      }
      return next;
    });
  }

  return (
    <div className="pb-10">
      <AuthPanel
        user={session.user}
        cognitoConfigured={session.cognitoConfigured}
        loading={session.authLoading}
        status={session.authStatus}
        error={session.authError}
        onSignUp={session.signUp}
        onConfirmSignUp={session.confirmSignUp}
        onSignIn={session.signIn}
        onSendPasswordReset={session.sendPasswordReset}
        onConfirmPasswordReset={session.confirmPasswordReset}
        onSignOut={session.signOut}
        onDeleteAccount={session.deleteAccount}
      />

      <AnalyticsDashboard items={dashboardItems} onLabelSelect={setHistoryFilter} />

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(360px,0.45fr)]">
        <div className="rounded-2xl border border-white/10 bg-[#0d131c] p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
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

          <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-black/20">
            {visibleFaqs.map((item, index) => {
              const expanded = expandedFaqs.has(item.question);

              return (
                <div
                  key={item.question}
                  className={index > 0 ? "border-t border-white/10" : ""}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(item.question)}
                    className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-emerald-400/[0.04]"
                    aria-expanded={expanded}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-100 sm:text-base">
                        {item.question}
                      </span>
                      <span
                        className={`mt-1 block text-xs leading-5 text-slate-400 sm:text-sm ${
                          expanded ? "" : "line-clamp-1"
                        }`}
                      >
                        {item.answer}
                      </span>
                    </span>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-300">
                      <ChevronDown
                        className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`}
                      />
                    </span>
                  </button>
                </div>
              );
            })}

            <div className="relative border-t border-white/10 py-4">
              <button
                type="button"
                onClick={() => setShowAllFaqs((current) => !current)}
                className="mx-auto flex h-10 min-w-56 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-6 text-sm font-semibold text-slate-200 transition hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200"
              >
                {showAllFaqs ? "Show less" : `Show ${faqs.length - visibleFaqs.length} more`}
                <ChevronDown className={`h-4 w-4 transition ${showAllFaqs ? "rotate-180" : ""}`} />
              </button>
            </div>
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
