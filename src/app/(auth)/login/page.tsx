"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sign in to your care management account
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
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] transition-colors"
            placeholder="you@agency.com"
            required
            autoFocus
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-[#028090] hover:text-[#026f7c] font-medium"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] transition-colors pr-10"
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-[#028090] hover:bg-[#026f7c] disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors shadow-sm mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Need an account?{" "}
        <Link
          href="/register"
          className="text-[#028090] hover:text-[#026f7c] font-medium"
        >
          Register your agency
        </Link>
      </p>

      <div className="mt-6 pt-5 border-t border-slate-100">
        <p className="text-xs text-slate-400 text-center mb-3 font-medium uppercase tracking-wide">
          Demo credentials
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Admin", email: "admin@sunrise.health" },
            { label: "Supervisor", email: "supervisor@sunrise.health" },
            { label: "Aide", email: "aide@sunrise.health" },
            { label: "Physician", email: "physician@sunrise.health" },
          ].map((c) => (
            <button
              key={c.email}
              type="button"
              onClick={() => {
                setEmail(c.email);
                setPassword("Admin@123!");
              }}
              className="text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              <span className="block text-xs font-semibold text-slate-700">
                {c.label}
              </span>
              <span className="block text-xs text-slate-400 truncate">
                {c.email}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
