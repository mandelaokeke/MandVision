"use client";

import Link from "next/link";
import { Bot, Camera, FileSearch, ShieldCheck } from "lucide-react";
import { AuthPanel } from "@/components/dashboard/AuthPanel";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

const useCases = [
  {
    title: "Upload evidence images",
    description: "Add scene photos, screenshots, or incident images for secure processing.",
    icon: Camera,
  },
  {
    title: "Identify visible objects",
    description: "MandVision detects objects and surfaces confidence scores for review.",
    icon: ShieldCheck,
  },
  {
    title: "Ask Viso about the image",
    description: "Ask whether an item appears, what labels were found, or what needs review.",
    icon: Bot,
  },
  {
    title: "Keep a review library",
    description: "Store processed files, revisit prior uploads, and manage case-like media history.",
    icon: FileSearch,
  },
];

export default function DashboardPage() {
  const { session } = useDashboard();

  return (
    <div className="pb-12">
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(380px,0.75fr)] lg:items-start">
        <div className="space-y-8">
          <div className="rounded-3xl border border-white/10 bg-[#0d131c] p-5 shadow-2xl shadow-black/20 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
              Security image intelligence
            </p>
            <h1 className="mt-4 max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Upload an image. Identify objects. Ask Viso what it sees.
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
              MandVision is a review workspace for security and evidence media. Upload an
              image, let the system detect visible objects, then ask Viso focused questions
              like whether a blue purse appears, what type of sweater is visible, or whether a
              suspicious item was detected.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/upload"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-semibold text-[#04100a] transition hover:bg-emerald-300"
              >
                Get started
              </Link>
              <Link
                href="/library"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 px-5 text-sm font-medium text-slate-200 transition hover:border-emerald-400/30 hover:text-emerald-200"
              >
                Open Library
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {useCases.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-[#0d131c] p-5"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-base font-semibold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                </article>
              );
            })}
          </div>

          <div className="rounded-2xl border border-sky-300/20 bg-sky-300/[0.06] p-5">
            <h2 className="text-lg font-semibold text-white">What do you do with it?</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Use MandVision as a first-pass visual review tool. It helps officers,
              investigators, property managers, or security teams organize an uploaded image,
              see detected objects, and ask follow-up questions before escalating the media for
              deeper review.
            </p>
          </div>
        </div>

        <div id="access" className="lg:sticky lg:top-6">
          <div className="rounded-3xl border border-white/10 bg-[#0d131c] p-2 shadow-2xl shadow-black/30">
            <div className="px-4 pt-4">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300/80">
                Access MandVision
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Sign up or sign in
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Create an account to keep your uploads and evidence review workspace organized.
              </p>
            </div>
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
              compact
            />
          </div>
        </div>
      </section>
    </div>
  );
}
