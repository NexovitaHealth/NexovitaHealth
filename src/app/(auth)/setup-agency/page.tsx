"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Building2,
} from "lucide-react";

type InvitePreview = {
  email: string;
  senderName: string;
  expiresAt: string;
};

function SetupAgencyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState("");

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError("No invitation token found. Please use the link from your email.");
      return;
    }
    fetch(`/api/agency-invitations/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Invalid invitation");
        setPreview(json.data);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Invalid invitation"));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/setup-agency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          fullName,
          email: preview!.email,
          password,
          agencyName,
          city: city || undefined,
          region: region || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Setup failed");
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="text-sm text-slate-600 mb-4">{loadError}</p>
        <Link href="/login" className="text-sm text-[#028090] font-medium hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-900 mb-2">Agency created!</h1>
        <p className="text-sm text-slate-500 mb-6">
          Your account and agency are ready. Sign in to get started.
        </p>
        <Link
          href="/login"
          className="inline-block bg-[#028090] text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[#026f7c] transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#028090]/10 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-[#028090]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Set up your agency</h1>
          <p className="text-xs text-slate-500">Invited by {preview.senderName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your account</p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoFocus
              placeholder="Jane Smith"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
            <input
              type="email"
              value={preview.email}
              readOnly
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 bg-slate-50 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Min. 8 characters"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Agency details</p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Agency name</label>
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              required
              placeholder="Sunrise Home Health"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                City <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Atlanta"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                State <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="GA"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
              />
            </div>
          </div>
        </div>

        {submitError && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-[#028090] hover:bg-[#026f7c] disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors shadow-sm"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Creating agency…</>
          ) : (
            "Create agency & account"
          )}
        </button>
      </form>
    </div>
  );
}

export default function SetupAgencyPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
        </div>
      }
    >
      <SetupAgencyContent />
    </Suspense>
  );
}
