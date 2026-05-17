"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send reset email");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 text-center">
        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Check your inbox
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          If an account exists for <strong>{email}</strong>, you&apos;ll receive
          a password reset link shortly.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#028090] hover:text-[#026f7c]"
        >
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Reset your password
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter your email and we&apos;ll send you a reset link
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
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] transition-colors"
            placeholder="you@agency.com"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-[#028090] hover:bg-[#026f7c] disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors shadow-sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Sending...
            </>
          ) : (
            "Send reset link"
          )}
        </button>
      </form>

      <p className="text-center mt-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </Link>
      </p>
    </div>
  );
}
