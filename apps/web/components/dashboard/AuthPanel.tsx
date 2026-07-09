"use client";

import { KeyRound, LogIn, LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import type { DashboardUser } from "@/hooks/useDashboardSession";

export function AuthPanel({
  user,
  onSignIn,
  onSignOut,
}: {
  user: DashboardUser | null;
  onSignIn: (values: { username: string; email?: string; password: string }) => void;
  onSignOut: () => void;
}) {
  const [mode, setMode] = useState<"signup" | "signin" | "forgot">("signup");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  if (user) {
    return (
      <section className="mx-auto max-w-7xl px-6 pt-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5 text-white md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-300">Personal dashboard</p>
              <p className="text-sm text-slate-300">
                Showing uploads owned by {user.name}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-6 pt-6">
      <div className="grid gap-4 rounded-2xl border border-white/10 bg-[#0d131c] p-5 text-white shadow-2xl shadow-black/20 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-300">
            {isForgot ? "Reset your password" : isSignup ? "Create your dashboard" : "Welcome back"}
          </p>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            {isForgot
              ? "Enter your username or email and MandVision will send a reset link."
              : isSignup
              ? "You can browse the public analytics first. Sign up to switch MandVision into your own image dashboard."
              : "Already have a MandVision profile? Sign in to view your personal uploads and analytics."}
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {!isForgot ? (
              <button
                type="button"
                onClick={() => setMode(isSignup ? "signin" : "signup")}
                className="text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
              >
                {isSignup
                  ? "Already have an account? Sign in"
                  : "New here? Create an account"}
              </button>
            ) : null}
            {!isSignup ? (
              <button
                type="button"
                onClick={() => {
                  setMode(isForgot ? "signin" : "signup");
                  setResetSent(false);
                }}
                className="text-sm font-medium text-slate-300 transition hover:text-white"
              >
                {isForgot ? "Back to sign in" : "Back to sign up"}
              </button>
            ) : null}
          </div>
        </div>
        {isForgot ? (
          <form
            className="grid gap-3 sm:grid-cols-[minmax(240px,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setResetSent(true);
            }}
          >
            <input
              value={resetIdentifier}
              onChange={(event) => setResetIdentifier(event.target.value)}
              placeholder="Username or email"
              required
              className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-[#04100a] transition hover:bg-emerald-300"
            >
              <KeyRound className="h-4 w-4" />
              Send Reset Link
            </button>
            {resetSent ? (
              <p className="text-sm text-emerald-300 sm:col-span-2">
                Password reset link queued for {resetIdentifier}. Email delivery will connect when real auth is added.
              </p>
            ) : null}
          </form>
        ) : (
          <form
            className={`grid gap-3 ${
              isSignup
                ? "sm:grid-cols-[minmax(130px,1fr)_minmax(190px,1.2fr)_minmax(150px,1fr)_auto]"
                : "sm:grid-cols-[minmax(160px,1fr)_minmax(150px,1fr)_auto]"
            }`}
            onSubmit={(event) => {
              event.preventDefault();
              onSignIn({ username, email: isSignup ? email : undefined, password });
            }}
          >
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              required
              className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
            {isSignup ? (
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                type="email"
                required
                className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
              />
            ) : null}
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              type="password"
              required
              className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-[#04100a] transition hover:bg-emerald-300"
            >
              <LogIn className="h-4 w-4" />
              {isSignup ? "Sign Up" : "Sign In"}
            </button>
            {!isSignup ? (
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setResetSent(false);
                }}
                className="text-left text-sm font-medium text-emerald-300 transition hover:text-emerald-200 sm:col-span-3"
              >
                Forgot password?
              </button>
            ) : null}
          </form>
        )}
      </div>
    </section>
  );
}
