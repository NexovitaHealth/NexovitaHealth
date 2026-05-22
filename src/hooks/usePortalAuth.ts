"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type PortalSession = {
  subjectType: "patient" | "family_caregiver";
  org: { id: string; name: string; slug: string };
  patient: { id: string; fullName: string };
  familyCaregiver?: {
    id: string;
    relationship: string;
    user: { id: string; email: string; fullName: string };
  };
  permissions: {
    subjectType: string;
    canViewSchedule: boolean;
    canViewCarePlan: boolean;
    canViewVitals: boolean;
    canMessageCareTeam: boolean;
  };
};

export function usePortalAuth() {
  const router = useRouter();
  const [session, setSession] = useState<PortalSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/auth/me", { credentials: "include" });
      const json = await res.json();
      if (res.ok && json.success) {
        setSession(json.data);
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loginWithToken = async (token: string) => {
    const res = await fetch("/api/portal/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Portal login failed");
    }
    setSession(json.data);
    router.push("/portal");
    router.refresh();
  };

  const logout = async () => {
    await fetch("/api/portal/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setSession(null);
    router.push("/portal/login");
    router.refresh();
  };

  return {
    session,
    isLoading,
    isAuthenticated: Boolean(session),
    loginWithToken,
    logout,
    refresh,
  };
}
