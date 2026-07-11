"use client";

import { useEffect, useState } from "react";
import {
  confirmForgotPasswordWithCognito,
  confirmSignUpWithCognito,
  deleteCognitoUser,
  forgotPasswordWithCognito,
  isCognitoConfigured,
  signInWithCognito,
  signOutWithCognito,
  signUpWithCognito,
  type CognitoSession,
} from "@/lib/cognito";

export type DashboardUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  accessToken?: string;
};

const SESSION_STORAGE_KEY = "mandvision.dashboardUser";
const GUEST_SESSION_STORAGE_KEY = "mandvision.guestSessionId";

export function useDashboardSession() {
  const [guestSessionId, setGuestSessionId] = useState(() => getOrCreateGuestSessionId());
  const [user, setUser] = useState<DashboardUser | null>(() => {
    if (typeof window === "undefined") return null;

    try {
      const storedUser = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (!storedUser) return null;

      const parsedUser = JSON.parse(storedUser) as Partial<DashboardUser>;

      if (!parsedUser.id) return null;

      return {
        id: parsedUser.id,
        username:
          parsedUser.username ||
          parsedUser.email?.split("@")[0] ||
          parsedUser.id,
        email: parsedUser.email || "",
        name:
          parsedUser.name ||
          parsedUser.username ||
          parsedUser.email?.split("@")[0] ||
          parsedUser.id,
        accessToken: parsedUser.accessToken,
      };
    } catch (error) {
      console.error("Could not load dashboard session", error);
      return null;
    }
  });

  useEffect(() => {
    try {
      if (user) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
        return;
      }

      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error("Could not save dashboard session", error);
    }
  }, [user]);

  const [authStatus, setAuthStatus] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  async function signUp({
    username,
    email,
    password,
  }: {
    username: string;
    email: string;
    password: string;
  }) {
    setAuthLoading(true);
    setAuthError("");
    setAuthStatus("");

    try {
      const normalizedUsername = username.trim().toLowerCase();
      const normalizedEmail = email.trim().toLowerCase();

      await signUpWithCognito({
        username: normalizedUsername,
        email: normalizedEmail,
        password,
      });

      setAuthStatus("Check your email for the confirmation code.");
      return true;
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  async function confirmSignUp({
    username,
    code,
  }: {
    username: string;
    code: string;
  }) {
    setAuthLoading(true);
    setAuthError("");
    setAuthStatus("");

    try {
      await confirmSignUpWithCognito({
        username: username.trim().toLowerCase(),
        code: code.trim(),
      });

      setAuthStatus("Account confirmed. You can sign in now.");
      return true;
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  async function signIn({
    username,
    email,
    password,
  }: {
    username: string;
    email?: string;
    password: string;
  }) {
    setAuthLoading(true);
    setAuthError("");
    setAuthStatus("");

    try {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email?.trim().toLowerCase() || "";
    const displayName = username.trim() || normalizedEmail.split("@")[0];

    if (!normalizedUsername) return false;
      const session = await signInWithCognito({
        username: normalizedUsername,
        password,
      });

      setUser(buildDashboardUser(normalizedUsername, normalizedEmail, displayName, session));
      clearGuestSessionId();
      setAuthStatus("Signed in.");
      return true;
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  async function sendPasswordReset(username: string) {
    setAuthLoading(true);
    setAuthError("");
    setAuthStatus("");

    try {
      await forgotPasswordWithCognito(username.trim().toLowerCase());
      setAuthStatus("Password reset code sent. Check your email.");
      return true;
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  async function confirmPasswordReset({
    username,
    code,
    newPassword,
  }: {
    username: string;
    code: string;
    newPassword: string;
  }) {
    setAuthLoading(true);
    setAuthError("");
    setAuthStatus("");

    try {
      await confirmForgotPasswordWithCognito({
        username: username.trim().toLowerCase(),
        code: code.trim(),
        newPassword,
      });
      setAuthStatus("Password updated. You can sign in now.");
      return true;
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOut() {
    try {
      await signOutWithCognito(user?.accessToken);
    } catch (error) {
      console.error("Could not sign out of Cognito", error);
    }

    setUser(null);
    setGuestSessionId(resetGuestSessionId());
  }

  async function deleteAccount() {
    setAuthLoading(true);
    setAuthError("");

    try {
      await deleteCognitoUser(user?.accessToken);
      setUser(null);
      setGuestSessionId(resetGuestSessionId());
      setAuthStatus("Account deleted.");
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  }

  return {
    user,
    guestSessionId,
    signedIn: Boolean(user),
    cognitoConfigured: isCognitoConfigured(),
    authLoading,
    authStatus,
    authError,
    signUp,
    confirmSignUp,
    signIn,
    sendPasswordReset,
    confirmPasswordReset,
    signOut,
    deleteAccount,
  };
}

function getOrCreateGuestSessionId() {
  if (typeof window === "undefined") return "";

  try {
    const existingGuestSessionId = window.sessionStorage.getItem(GUEST_SESSION_STORAGE_KEY);
    if (existingGuestSessionId) return existingGuestSessionId;

    return resetGuestSessionId();
  } catch (error) {
    console.error("Could not load guest session", error);
    return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function resetGuestSessionId() {
  const nextGuestSessionId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `guest-${crypto.randomUUID()}`
      : `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    window.sessionStorage.setItem(GUEST_SESSION_STORAGE_KEY, nextGuestSessionId);
  } catch (error) {
    console.error("Could not save guest session", error);
  }

  return nextGuestSessionId;
}

function clearGuestSessionId() {
  try {
    window.sessionStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
  } catch (error) {
    console.error("Could not clear guest session", error);
  }
}

function buildDashboardUser(
  normalizedUsername: string,
  normalizedEmail: string,
  displayName: string,
  session: CognitoSession
): DashboardUser {
  return {
    id: normalizedUsername,
    username: normalizedUsername,
    email: normalizedEmail,
    name: displayName || normalizedUsername,
    accessToken: session.accessToken,
  };
}

function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Authentication request failed. Please try again.";
}
