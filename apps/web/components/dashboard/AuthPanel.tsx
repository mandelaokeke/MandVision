"use client";

import { KeyRound, LogIn, LogOut, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import type { DashboardUser } from "@/hooks/useDashboardSession";

export function AuthPanel({
  user,
  cognitoConfigured,
  loading,
  status,
  error,
  onSignUp,
  onConfirmSignUp,
  onSignIn,
  onSendPasswordReset,
  onConfirmPasswordReset,
  onSignOut,
  onDeleteAccount,
  compact = false,
}: {
  user: DashboardUser | null;
  cognitoConfigured: boolean;
  loading: boolean;
  status: string;
  error: string;
  onSignUp: (values: { username: string; email: string; password: string }) => Promise<boolean>;
  onConfirmSignUp: (values: { username: string; code: string }) => Promise<boolean>;
  onSignIn: (values: { username: string; email?: string; password: string }) => Promise<boolean>;
  onSendPasswordReset: (username: string) => Promise<boolean>;
  onConfirmPasswordReset: (values: {
    username: string;
    code: string;
    newPassword: string;
  }) => Promise<boolean>;
  onSignOut: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"signup" | "confirm" | "signin" | "forgot" | "reset">("signup");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetIdentifier, setResetIdentifier] = useState("");
  const isSignup = mode === "signup";
  const isConfirm = mode === "confirm";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";

  if (user) {
    return (
      <section className={compact ? "p-4" : "mx-auto max-w-7xl px-6 pt-6"}>
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSignOut}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                if (window.confirm("Delete this MandVision account?")) {
                  void onDeleteAccount();
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-400/20"
            >
              <Trash2 className="h-4 w-4" />
              Delete Account
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={compact ? "p-4" : "mx-auto max-w-7xl px-6 pt-6"}>
      <div
        className={`grid gap-4 rounded-2xl border border-white/10 bg-[#0d131c] p-5 text-white shadow-2xl shadow-black/20 ${
          compact ? "" : "lg:grid-cols-[1fr_auto] lg:items-end"
        }`}
      >
        <div>
          <p className="text-sm font-semibold text-emerald-300">
            {isConfirm
              ? "Confirm your email"
              : isForgot || isReset
              ? "Reset your password"
              : isSignup
              ? "Create your dashboard"
              : "Welcome back"}
          </p>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            {isConfirm
              ? "Enter the confirmation code Cognito sent to your email."
              : isForgot
              ? "Enter your username and MandVision will send a reset code."
              : isReset
              ? "Enter the reset code and choose a new password."
              : isSignup
              ? "Create an account to upload images, review detected objects, and keep your evidence library organized."
              : "Sign in to open your Library and continue reviewing processed evidence."}
          </p>
          {!cognitoConfigured ? (
            <p className="mt-2 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
              Cognito is not configured for this deployment yet.
            </p>
          ) : null}
          {status ? (
            <p className="mt-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">
              {status}
            </p>
          ) : null}
          {error ? (
            <p className="mt-2 rounded-lg border border-red-300/20 bg-red-300/10 px-3 py-2 text-sm text-red-100">
              {error}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-3">
            {!isForgot && !isReset && !isConfirm ? (
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
            {isConfirm ? (
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
              >
                Already confirmed? Sign in
              </button>
            ) : null}
            {!isSignup ? (
              <button
                type="button"
                onClick={() => {
                  setMode(isForgot || isReset || isConfirm ? "signin" : "signup");
                }}
                className="text-sm font-medium text-slate-300 transition hover:text-white"
              >
                {isForgot || isReset || isConfirm ? "Back to sign in" : "Back to sign up"}
              </button>
            ) : null}
          </div>
        </div>
        {isConfirm ? (
          <form
            className="grid gap-3 sm:grid-cols-[minmax(170px,1fr)_minmax(130px,0.8fr)_auto]"
            onSubmit={async (event) => {
              event.preventDefault();
              const confirmed = await onConfirmSignUp({ username, code: confirmationCode });
              if (confirmed) setMode("signin");
            }}
          >
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              required
              className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
            <input
              value={confirmationCode}
              onChange={(event) => setConfirmationCode(event.target.value)}
              placeholder="Code"
              required
              className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
            <button
              type="submit"
              disabled={loading || !cognitoConfigured}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-[#04100a] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirm
            </button>
          </form>
        ) : isForgot ? (
          <form
            className="grid gap-3 sm:grid-cols-[minmax(240px,1fr)_auto]"
            onSubmit={async (event) => {
              event.preventDefault();
              const sent = await onSendPasswordReset(resetIdentifier || username);
              if (sent) {
                setUsername(resetIdentifier || username);
                setMode("reset");
              }
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
              disabled={loading || !cognitoConfigured}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-[#04100a] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
              Send Reset Code
            </button>
          </form>
        ) : isReset ? (
          <form
            className="grid gap-3 sm:grid-cols-[minmax(150px,1fr)_minmax(110px,0.7fr)_minmax(150px,1fr)_auto]"
            onSubmit={async (event) => {
              event.preventDefault();
              const reset = await onConfirmPasswordReset({
                username,
                code: confirmationCode,
                newPassword,
              });
              if (reset) setMode("signin");
            }}
          >
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              required
              className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
            <input
              value={confirmationCode}
              onChange={(event) => setConfirmationCode(event.target.value)}
              placeholder="Code"
              required
              className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
            <input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password"
              type="password"
              required
              className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
            <button
              type="submit"
              disabled={loading || !cognitoConfigured}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-[#04100a] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Update Password
            </button>
          </form>
        ) : (
          <form
            className={`grid gap-3 ${
              compact
                ? ""
                : isSignup
                ? "sm:grid-cols-[minmax(130px,1fr)_minmax(190px,1.2fr)_minmax(150px,1fr)_auto]"
                : "sm:grid-cols-[minmax(160px,1fr)_minmax(150px,1fr)_auto]"
            }`}
            onSubmit={async (event) => {
              event.preventDefault();
              if (isSignup) {
                const signedUp = await onSignUp({ username, email, password });
                if (signedUp) setMode("confirm");
                return;
              }

              await onSignIn({ username, email: undefined, password });
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
              disabled={loading || !cognitoConfigured}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-[#04100a] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" />
              {loading ? "Working..." : isSignup ? "Sign Up" : "Sign In"}
            </button>
            {!isSignup ? (
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
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
