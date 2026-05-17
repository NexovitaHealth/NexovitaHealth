"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";

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
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setActiveOrg: (orgId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
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
  }, []);

  const login = async (email: string, password: string) => {
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
    router.push("/dashboard");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setActiveOrgId(null);
    router.push("/login");
  };

  const setActiveOrg = (orgId: string) => setActiveOrgId(orgId);

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
        login,
        logout,
        refresh,
        setActiveOrg,
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
