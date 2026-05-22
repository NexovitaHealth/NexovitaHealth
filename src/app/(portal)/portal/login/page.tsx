"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { usePortalAuth } from "@/hooks/usePortalAuth";

function PortalLoginForm() {
  const searchParams = useSearchParams();
  const { loginWithToken, isAuthenticated } = usePortalAuth();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (urlToken) setToken(urlToken);
  }, [searchParams]);

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = "/portal";
    }
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await loginWithToken(token.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#028090] flex items-center justify-center">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <span className="text-xl font-bold text-slate-900">Nexovita Portal</span>
          </div>
          <p className="text-sm text-slate-500">
            Secure read-only access for patients and family caregivers
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Access link token
            </label>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 font-mono min-h-[88px] focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
              placeholder="Paste the token from your email link"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !token.trim()}
            className="w-full py-2.5 rounded-xl bg-[#028090] text-white text-sm font-semibold hover:bg-[#026d7a] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Sign in to portal
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Agency staff?{" "}
          <Link href="/login" className="text-[#028090] font-medium hover:underline">
            Sign in to Nexovita
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
        </div>
      }
    >
      <PortalLoginForm />
    </Suspense>
  );
}
