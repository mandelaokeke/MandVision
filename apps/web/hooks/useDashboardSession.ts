"use client";

import { useEffect, useState } from "react";

export type DashboardUser = {
  id: string;
  username: string;
  name: string;
  email: string;
};

const SESSION_STORAGE_KEY = "mandvision.dashboardUser";

export function useDashboardSession() {
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

  function signIn({
    username,
    email,
  }: {
    username: string;
    email?: string;
    password: string;
  }) {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email?.trim().toLowerCase() || "";
    const displayName = username.trim() || normalizedEmail.split("@")[0];

    if (!normalizedUsername) return;

    setUser({
      id: normalizedUsername,
      username: normalizedUsername,
      email: normalizedEmail,
      name: displayName,
    });
  }

  function signOut() {
    setUser(null);
  }

  return {
    user,
    signedIn: Boolean(user),
    signIn,
    signOut,
  };
}
