"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"account" | "org">("account");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    orgName: "",
    orgSlug: "",
    inviteToken: "",
    hasInvite: false,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("inviteToken");
    const email = params.get("email");
    if (inviteToken) {
      setForm((prev) => ({
        ...prev,
        inviteToken,
        hasInvite: true,
        email: email || prev.email,
      }));
      setStep("account");
    }
  }, []);

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value =
        e.target.type === "checkbox" ? e.target.checked : e.target.value;
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        // Auto-generate slug from org name
        if (key === "orgName") {
          next.orgSlug = (value as string)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        }
        return next;
      });
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === "account" && !form.hasInvite) {
      setStep("org");
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      const body: Record<string, string> = {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
      };
      if (form.hasInvite) {
        body.inviteToken = form.inviteToken;
      } else {
        body.orgName = form.orgName;
        body.orgSlug = form.orgSlug;
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      router.push(form.hasInvite ? "/dashboard" : "/login?registered=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Create your account
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {form.hasInvite
            ? "Join your team on Nexovita"
            : "Set up your agency on Nexovita Health"}
        </p>
      </div>

      {/* Step indicator */}
      {!form.hasInvite && (
        <div className="flex items-center gap-2 mb-6">
          {["Account", "Organization"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`h-px flex-1 w-8 ${step === "org" ? "bg-[#028090]" : "bg-slate-200"}`}
                />
              )}
              <div
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  (i === 0 && step === "account") || (i === 1 && step === "org")
                    ? "text-[#028090]"
                    : i === 0 && step === "org"
                      ? "text-slate-400"
                      : "text-slate-300"
                }`}
              >
                {i === 0 && step === "org" ? (
                  <CheckCircle2 className="w-4 h-4 text-[#028090]" />
                ) : (
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      (i === 0 && step === "account") ||
                      (i === 1 && step === "org")
                        ? "bg-[#028090] text-white"
                        : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    {i + 1}
                  </div>
                )}
                {s}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {step === "account" && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Full name
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={set("fullName")}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] transition-colors"
                placeholder="Dr. Jane Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] transition-colors"
                placeholder="you@agency.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  required
                  minLength={8}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] transition-colors pr-10"
                  placeholder="Min. 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={form.hasInvite}
                onChange={set("hasInvite")}
                className="rounded border-slate-300 text-[#028090]"
              />
              <span className="text-sm text-slate-600">
                I have an invitation code
              </span>
            </label>

            {form.hasInvite && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Invitation token
                </label>
                <input
                  type="text"
                  value={form.inviteToken}
                  onChange={set("inviteToken")}
                  required={form.hasInvite}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] transition-colors"
                  placeholder="Paste your invitation token"
                />
              </div>
            )}
          </>
        )}

        {step === "org" && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Agency / Organization name
              </label>
              <input
                type="text"
                value={form.orgName}
                onChange={set("orgName")}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] transition-colors"
                placeholder="Sunrise Health Agency"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Organization URL slug
              </label>
              <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#028090]/25 focus-within:border-[#028090] transition-colors">
                <span className="bg-slate-50 border-r border-slate-200 px-3 py-2.5 text-sm text-slate-400 flex-shrink-0">
                  nexovita.app/
                </span>
                <input
                  type="text"
                  value={form.orgSlug}
                  onChange={set("orgSlug")}
                  required
                  pattern="[a-z0-9-]+"
                  className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                  placeholder="sunrise-health"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Lowercase letters, numbers and hyphens only
              </p>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-1">
          {step === "org" && (
            <button
              type="button"
              onClick={() => setStep("account")}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-[#028090] hover:bg-[#026f7c] disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Creating...
              </>
            ) : step === "account" && !form.hasInvite ? (
              "Continue →"
            ) : (
              "Create account"
            )}
          </button>
        </div>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-[#028090] hover:text-[#026f7c] font-medium"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
