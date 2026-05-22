"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

type InvitePreview = {
  email: string;
  role: string;
  orgName: string;
  inviterName: string;
  expiresAt: string;
};

export default function InviteAcceptPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const { user, isLoading: authLoading, refresh } = useAuth();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [acceptError, setAcceptError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    fetch(`/api/invitations/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Invalid invitation");
        setPreview(json.data);
      })
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Invalid invitation"),
      );
  }, [token]);

  const emailMatches =
    user?.email?.toLowerCase() === preview?.email.toLowerCase();

  const handleAccept = async () => {
    setAcceptError("");
    setAccepting(true);
    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not accept invitation");
      setAccepted(true);
      await refresh();
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : "Accept failed");
    } finally {
      setAccepting(false);
    }
  };

  if (loadError) {
    return (
      <div className="bg-white rounded-2xl border p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="text-sm text-slate-600">{loadError}</p>
        <Link href="/login" className="text-sm text-[#028090] mt-4 inline-block">
          Back to sign in
        </Link>
      </div>
    );
  }

  if (!preview || authLoading) {
    return (
      <div className="bg-white rounded-2xl border p-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="bg-white rounded-2xl border p-8 text-center">
        <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-slate-900">You&apos;re in!</h1>
        <p className="text-sm text-slate-600 mt-2">
          Welcome to {preview.orgName}. Redirecting…
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Join {preview.orgName}</h1>
      <p className="text-sm text-slate-600 mb-6">
        {preview.inviterName} invited you as{" "}
        <span className="font-medium capitalize">{preview.role}</span>.
      </p>

      <dl className="text-sm space-y-2 mb-6 bg-slate-50 rounded-xl p-4">
        <div className="flex justify-between">
          <dt className="text-slate-500">Email</dt>
          <dd className="font-medium">{preview.email}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Expires</dt>
          <dd>{new Date(preview.expiresAt).toLocaleDateString()}</dd>
        </div>
      </dl>

      {acceptError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
          {acceptError}
        </p>
      )}

      {user ? (
        emailMatches ? (
          <button
            type="button"
            onClick={handleAccept}
            disabled={accepting}
            className="w-full py-3 rounded-xl bg-[#028090] text-white font-medium disabled:opacity-50"
          >
            {accepting ? "Joining…" : `Accept invitation`}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3">
              Signed in as {user.email}. This invite was sent to {preview.email}.
            </p>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="w-full py-2.5 rounded-xl border text-sm font-medium"
            >
              Sign in with correct account
            </button>
          </div>
        )
      ) : (
        <div className="space-y-3">
          <Link
            href={`/register?inviteToken=${token}&email=${encodeURIComponent(preview.email)}`}
            className="block w-full py-3 rounded-xl bg-[#028090] text-white font-medium text-center"
          >
            Create account
          </Link>
          <Link
            href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
            className="block w-full py-2.5 rounded-xl border text-sm font-medium text-center"
          >
            Sign in to accept
          </Link>
        </div>
      )}
    </div>
  );
}
