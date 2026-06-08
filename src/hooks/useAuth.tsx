"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { getStaffHomePath } from "@/lib/physician-nav";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  avatarUrl?: string;
  orgMemberships: Array<{
    orgId: string;
    role: string;
    isPrimary: boolean;
    org: { id: string; name: string; slug: string };
  }>;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  activeOrg: User["orgMemberships"][0] | null;
  activeBranchId: string | null;
  login: (email: string, password: string, redirectTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setActiveOrg: (orgId: string) => void;
  setActiveBranch: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const { data } = await res.json();
        setUser(data);
        if (!activeOrgId && data.orgMemberships.length > 0) {
          const primary =
            data.orgMemberships.find(
              (m: User["orgMemberships"][0]) => m.isPrimary,
            ) || data.orgMemberships[0];
          setActiveOrgId(primary.orgId);
        }
      } else {
        // Clear any stale session cookie (e.g. after a DB reset) so the edge
        // middleware stops letting through an expired JWT. Don't redirect here —
        // protected layouts already redirect when isAuthenticated is false, and
        // public pages (invite, portal) should stay accessible to guests.
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string, redirectTo?: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    setUser(data.data.user);
    const primary =
      data.data.user.orgMemberships.find(
        (m: User["orgMemberships"][0]) => m.isPrimary,
      ) || data.data.user.orgMemberships[0];
    if (primary) setActiveOrgId(primary.orgId);
    router.push(redirectTo || getStaffHomePath(data.data.user.role));
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setActiveOrgId(null);
    router.push("/login");
  };

  const setActiveOrg = (orgId: string) => setActiveOrgId(orgId);

  useEffect(() => {
    if (!activeOrgId) {
      setActiveBranchIdState(null);
      return;
    }
    const stored = localStorage.getItem(`nexovita_branch_${activeOrgId}`);
    setActiveBranchIdState(stored || null);
  }, [activeOrgId]);

  const setActiveBranch = (id: string | null) => {
    setActiveBranchIdState(id);
    if (activeOrgId) {
      if (id) {
        localStorage.setItem(`nexovita_branch_${activeOrgId}`, id);
      } else {
        localStorage.removeItem(`nexovita_branch_${activeOrgId}`);
      }
    }
  };

  const activeOrg =
    user?.orgMemberships.find((m) => m.orgId === activeOrgId) ||
    user?.orgMemberships[0] ||
    null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        activeOrg,
        activeBranchId,
        login,
        logout,
        refresh,
        setActiveOrg,
        setActiveBranch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
