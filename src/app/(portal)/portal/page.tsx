"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  FileText,
  FlaskConical,
  Heart,
  Loader2,
  LogOut,
  MessageSquare,
  Pill,
  Users,
} from "lucide-react";
import { usePortalAuth } from "@/hooks/usePortalAuth";

type TabId =
  | "overview"
  | "care_plan"
  | "visits"
  | "vitals"
  | "medications"
  | "labs"
  | "documents"
  | "care_team"
  | "messages";

async function portalFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(path, { credentials: "include" });
  const json = await res.json();
  if (!res.ok) return null;
  return json.data as T;
}

export default function PortalHomePage() {
  const router = useRouter();
  const { session, isLoading, isAuthenticated, logout } = usePortalAuth();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [loadError, setLoadError] = useState("");

  const [overview, setOverview] = useState<unknown>(null);
  const [carePlan, setCarePlan] = useState<unknown>(null);
  const [visits, setVisits] = useState<unknown[]>([]);
  const [vitals, setVitals] = useState<unknown[]>([]);
  const [medications, setMedications] = useState<unknown[]>([]);
  const [labs, setLabs] = useState<unknown[]>([]);
  const [documents, setDocuments] = useState<unknown[]>([]);
  const [careTeam, setCareTeam] = useState<unknown[]>([]);
  const [threads, setThreads] = useState<unknown[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<unknown[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/portal/login");
    }
  }, [isLoading, isAuthenticated, router]);

  const loadTabData = useCallback(async () => {
    if (!session) return;
    setLoadError("");
    const perms = session.permissions;

    try {
      if (activeTab === "overview") {
        setOverview(await portalFetch("/api/portal/overview"));
      }
      if (activeTab === "care_plan" && perms.canViewCarePlan) {
        setCarePlan(await portalFetch("/api/portal/care-plan"));
      }
      if (activeTab === "visits" && perms.canViewSchedule) {
        setVisits((await portalFetch<unknown[]>("/api/portal/visits?days=30")) || []);
      }
      if (activeTab === "vitals" && perms.canViewVitals) {
        setVitals((await portalFetch<unknown[]>("/api/portal/vitals?limit=15")) || []);
      }
      if (activeTab === "medications") {
        setMedications(
          (await portalFetch<unknown[]>("/api/portal/medications")) || [],
        );
      }
      if (activeTab === "labs") {
        setLabs((await portalFetch<unknown[]>("/api/portal/labs")) || []);
      }
      if (activeTab === "documents") {
        setDocuments(
          (await portalFetch<unknown[]>("/api/portal/documents")) || [],
        );
      }
      if (activeTab === "care_team") {
        setCareTeam(
          (await portalFetch<unknown[]>("/api/portal/care-team")) || [],
        );
      }
      if (activeTab === "messages" && perms.canMessageCareTeam) {
        const list =
          (await portalFetch<unknown[]>("/api/portal/messages/threads")) || [];
        setThreads(list);
        if (activeThreadId) {
          setThreadMessages(
            (await portalFetch<unknown[]>(
              `/api/portal/messages/threads/${activeThreadId}`,
            )) || [],
          );
        }
      }
    } catch {
      setLoadError("Could not load this section.");
    }
  }, [session, activeTab, activeThreadId]);

  useEffect(() => {
    if (isAuthenticated && session) loadTabData();
  }, [isAuthenticated, session, loadTabData]);

  const sendMessage = async () => {
    if (!messageDraft.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          threadId: activeThreadId || undefined,
          content: messageDraft.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Send failed");
      setMessageDraft("");
      if (!activeThreadId && json.data?.threadId) {
        setActiveThreadId(json.data.threadId);
      }
      await loadTabData();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
      </div>
    );
  }

  if (!session) return null;

  const portalTitle =
    session.subjectType === "patient"
      ? "Patient Portal"
      : `Family Caregiver · ${session.familyCaregiver?.relationship || "Caregiver"}`;

  const tabs = (
    [
      { id: "overview" as const, label: "Overview", icon: Heart, show: true },
      {
        id: "care_plan" as const,
        label: "Care Plan",
        icon: FileText,
        show: session.permissions.canViewCarePlan,
      },
      {
        id: "visits" as const,
        label: "Visits",
        icon: Calendar,
        show: session.permissions.canViewSchedule,
      },
      {
        id: "vitals" as const,
        label: "Vitals",
        icon: Heart,
        show: session.permissions.canViewVitals,
      },
      { id: "medications" as const, label: "Medications", icon: Pill, show: true },
      { id: "labs" as const, label: "Labs", icon: FlaskConical, show: true },
      { id: "documents" as const, label: "Documents", icon: FileText, show: true },
      { id: "care_team" as const, label: "Care Team", icon: Users, show: true },
      {
        id: "messages" as const,
        label: "Messages",
        icon: MessageSquare,
        show: session.permissions.canMessageCareTeam,
      },
    ] as const
  ).filter((t) => t.show);

  const patientOverview = overview as {
    patient?: {
      fullName: string;
      status: string;
      riskLevel: string;
      primaryDiagnosis: string | null;
    };
  } | null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <header className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#028090]">
            {portalTitle}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            {session.patient.fullName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{session.org.name}</p>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </header>

      <div className="flex flex-wrap gap-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== "messages") setActiveThreadId(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium ${
              activeTab === tab.id
                ? "bg-[#028090] text-white"
                : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {loadError && (
        <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          {loadError}
        </p>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm min-h-[280px]">
        {activeTab === "overview" && patientOverview?.patient && (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium capitalize">
                {patientOverview.patient.status.replace("_", " ")}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Risk level</dt>
              <dd className="font-medium capitalize">
                {patientOverview.patient.riskLevel}
              </dd>
            </div>
            {patientOverview.patient.primaryDiagnosis && (
              <div className="col-span-2">
                <dt className="text-slate-500">Primary diagnosis</dt>
                <dd className="font-medium">
                  {patientOverview.patient.primaryDiagnosis}
                </dd>
              </div>
            )}
          </dl>
        )}

        {activeTab === "care_plan" && (
          carePlan ? (
            <div className="text-sm">
              <p className="font-semibold text-slate-900">
                {(carePlan as { title?: string }).title}
              </p>
              <p className="text-slate-500 mt-1">
                Version {(carePlan as { version?: number }).version} ·{" "}
                {(carePlan as { status?: string }).status}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No active care plan on file.</p>
          )
        )}

        {activeTab === "visits" && (
          visits.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming visits.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {(visits as Array<{ id: string; visitType: string; status: string; scheduledAt: string }>).map(
                (v) => (
                  <li key={v.id} className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="font-medium">{v.visitType}</span>
                    <span className="text-slate-500">
                      {new Date(v.scheduledAt).toLocaleString()}
                    </span>
                  </li>
                ),
              )}
            </ul>
          )
        )}

        {activeTab === "vitals" && (
          vitals.length === 0 ? (
            <p className="text-sm text-slate-500">No vitals recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(vitals as Array<{ id: string; recordedAt: string; systolicBp?: number; diastolicBp?: number; heartRate?: number }>).map(
                (v) => (
                  <li key={v.id} className="flex justify-between">
                    <span>
                      {v.systolicBp && v.diastolicBp
                        ? `BP ${v.systolicBp}/${v.diastolicBp}`
                        : "Vitals"}
                      {v.heartRate ? ` · HR ${v.heartRate}` : ""}
                    </span>
                    <span className="text-slate-500">
                      {new Date(v.recordedAt).toLocaleString()}
                    </span>
                  </li>
                ),
              )}
            </ul>
          )
        )}

        {activeTab === "medications" && (
          medications.length === 0 ? (
            <p className="text-sm text-slate-500">No active medications.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {(medications as Array<{ id: string; name: string; dosage?: string; frequency?: string }>).map(
                (m) => (
                  <li key={m.id}>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-slate-500">
                      {[m.dosage, m.frequency].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </li>
                ),
              )}
            </ul>
          )
        )}

        {activeTab === "labs" && (
          labs.length === 0 ? (
            <p className="text-sm text-slate-500">No lab results available.</p>
          ) : (
            <ul className="space-y-4 text-sm">
              {(labs as Array<{ id: string; panelName: string; status: string; results: Array<{ componentName: string; value: string; isAbnormal: boolean }> }>).map(
                (lab) => (
                  <li key={lab.id}>
                    <p className="font-medium">{lab.panelName}</p>
                    <p className="text-slate-500 capitalize mb-1">{lab.status}</p>
                    <ul className="text-slate-600 space-y-0.5">
                      {lab.results?.slice(0, 6).map((r) => (
                        <li key={r.componentName}>
                          {r.componentName}: {r.value}
                          {r.isAbnormal ? " (abnormal)" : ""}
                        </li>
                      ))}
                    </ul>
                  </li>
                ),
              )}
            </ul>
          )
        )}

        {activeTab === "documents" && (
          documents.length === 0 ? (
            <p className="text-sm text-slate-500">No verified documents shared.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(documents as Array<{ id: string; title: string; documentType: string; fileUrl: string; createdAt: string }>).map(
                (doc) => (
                  <li key={doc.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{doc.title}</p>
                      <p className="text-slate-500 capitalize">{doc.documentType}</p>
                    </div>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#028090] text-xs font-medium hover:underline"
                    >
                      View
                    </a>
                  </li>
                ),
              )}
            </ul>
          )
        )}

        {activeTab === "care_team" && (
          careTeam.length === 0 ? (
            <p className="text-sm text-slate-500">No care team assigned.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {(careTeam as Array<{ id: string; role: string; user: { fullName: string; role: string } }>).map(
                (member) => (
                  <li key={member.id}>
                    <p className="font-medium">{member.user.fullName}</p>
                    <p className="text-slate-500 capitalize">
                      {member.role.replace("_", " ")} · {member.user.role.replace("_", " ")}
                    </p>
                  </li>
                ),
              )}
            </ul>
          )
        )}

        {activeTab === "messages" && (
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-1 border-r border-slate-100 pr-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setActiveThreadId(null);
                  setThreadMessages([]);
                }}
                className="w-full text-left text-sm font-medium text-[#028090] hover:underline"
              >
                + New message to care team
              </button>
              {(threads as Array<{ id: string; subject?: string; lastMessage: string }>).map(
                (thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setActiveThreadId(thread.id)}
                    className={`w-full text-left p-2 rounded-lg text-sm ${
                      activeThreadId === thread.id ? "bg-teal-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-medium truncate">
                      {thread.subject || "Care team thread"}
                    </p>
                    <p className="text-slate-500 truncate text-xs">{thread.lastMessage}</p>
                  </button>
                ),
              )}
            </div>
            <div className="md:col-span-2 flex flex-col min-h-[220px]">
              <div className="flex-1 space-y-2 mb-4 max-h-64 overflow-y-auto">
                {(threadMessages as Array<{ id: string; content: string; sender: { fullName: string }; createdAt: string }>).map(
                  (msg) => (
                    <div key={msg.id} className="text-sm bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-slate-600">
                        {msg.sender.fullName}
                      </p>
                      <p className="text-slate-800 mt-0.5">{msg.content}</p>
                    </div>
                  ),
                )}
                {activeThreadId && threadMessages.length === 0 && (
                  <p className="text-sm text-slate-500">No messages in this thread yet.</p>
                )}
              </div>
              <div className="flex gap-2">
                <textarea
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  placeholder="Write a message to the care team..."
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[72px]"
                />
                <button
                  type="button"
                  disabled={sending || !messageDraft.trim()}
                  onClick={sendMessage}
                  className="self-end px-4 py-2 rounded-lg bg-[#028090] text-white text-sm disabled:opacity-50"
                >
                  {sending ? "..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
