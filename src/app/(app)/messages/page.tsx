"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { isFieldStaffRole } from "@/lib/message-scope";
import { ThreadList, type ThreadRow } from "@/components/messages/ThreadList";
import { ThreadConversation } from "@/components/messages/ThreadConversation";
import { NewThreadPanel } from "@/components/messages/NewThreadPanel";
import type { MessageTemplate } from "@/lib/message-templates";

type PatientOption = { id: string; fullName: string };

function applyTemplateBody(current: string, template: MessageTemplate) {
  if (!current.trim()) return template.body;
  return `${current.trim()}\n\n${template.body}`;
}

function MessagesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { request, orgId } = useApi();
  const { user } = useAuth();
  const qc = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fieldStaffMode = isFieldStaffRole(user?.role ?? "");

  const [selectedThread, setSelectedThread] = useState<string | null>(
    () => searchParams.get("threadId"),
  );
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newContent, setNewContent] = useState("");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [linkedPatient, setLinkedPatient] = useState<PatientOption | null>(
    null,
  );

  const updateUrl = (params: {
    threadId?: string | null;
    patientId?: string | null;
  }) => {
    const next = new URLSearchParams(searchParams.toString());
    if (params.threadId === null) next.delete("threadId");
    else if (params.threadId) next.set("threadId", params.threadId);
    if (params.patientId === null) next.delete("patientId");
    else if (params.patientId) next.set("patientId", params.patientId);
    const q = next.toString();
    router.replace(q ? `/messages?${q}` : "/messages", { scroll: false });
  };

  const selectThread = (threadId: string) => {
    setSelectedThread(threadId);
    setShowNewThread(false);
    updateUrl({ threadId, patientId: null });
  };

  const clearThread = () => {
    setSelectedThread(null);
    updateUrl({ threadId: null });
  };

  const openNewThread = () => {
    setShowNewThread(true);
    setSelectedThread(null);
    updateUrl({ threadId: null });
  };

  useEffect(() => {
    const threadId = searchParams.get("threadId");
    if (threadId) {
      setSelectedThread(threadId);
      setShowNewThread(false);
    }
  }, [searchParams]);

  useEffect(() => {
    const patientId = searchParams.get("patientId");
    if (!patientId || !orgId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await request<{ id: string; fullName: string }>(
          `/api/orgs/{orgId}/patients/${patientId}`,
        );
        if (cancelled) return;
        const p = res.data;
        if (p?.id && p?.fullName) {
          setLinkedPatient({ id: p.id, fullName: p.fullName });
          setShowNewThread(true);
          setSelectedThread(null);
        }
      } catch {
        /* patient not found or no access */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, orgId, request]);

  const { data: membersData } = useQuery({
    queryKey: ["members", orgId],
    queryFn: () => request("/api/orgs/{orgId}/members"),
    enabled: !!orgId && showNewThread && !fieldStaffMode,
  });

  const members =
    (membersData?.data as Array<{ id: string; fullName: string }>) || [];

  const { data: threadsData, isLoading: threadsLoading } = useQuery({
    queryKey: ["message-threads", orgId],
    queryFn: () => request("/api/orgs/{orgId}/messages/threads"),
    enabled: !!orgId,
    refetchInterval: 15_000,
  });

  const { data: messagesData } = useQuery({
    queryKey: ["messages", selectedThread],
    queryFn: () =>
      request(`/api/orgs/{orgId}/messages/threads/${selectedThread}`),
    enabled: !!selectedThread,
    refetchInterval: 10_000,
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      request("/api/orgs/{orgId}/messages", {
        method: "POST",
        body: JSON.stringify({ threadId: selectedThread, content: newMessage }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", selectedThread] });
      qc.invalidateQueries({ queryKey: ["message-threads"] });
      setNewMessage("");
    },
  });

  const createThreadMutation = useMutation({
    mutationFn: () =>
      request("/api/orgs/{orgId}/messages", {
        method: "POST",
        body: JSON.stringify({
          recipientIds,
          patientId: linkedPatient?.id,
          subject: newSubject || undefined,
          content: newContent,
        }),
      }),
    onSuccess: (res) => {
      const threadId = (res.data as { threadId?: string })?.threadId;
      qc.invalidateQueries({ queryKey: ["message-threads"] });
      setShowNewThread(false);
      setNewSubject("");
      setNewContent("");
      setRecipientIds([]);
      setLinkedPatient(null);
      updateUrl({ patientId: null });
      if (threadId) selectThread(threadId);
    },
  });

  const toggleRecipient = (id: string) => {
    setRecipientIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleNewThreadTemplate = (template: MessageTemplate) => {
    if (template.subject && !newSubject.trim()) {
      setNewSubject(template.subject);
    }
    setNewContent((c) => applyTemplateBody(c, template));
  };

  const handleReplyTemplate = (template: MessageTemplate) => {
    setNewMessage((c) => applyTemplateBody(c, template));
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData]);

  const threads = (threadsData?.data ?? []) as ThreadRow[];
  const messages = (messagesData?.data ?? []) as Array<{
    id: string;
    content: string;
    sentAt: string;
    sender?: { id: string; fullName: string };
  }>;
  const selectedThreadData = threads.find((t) => t.id === selectedThread);

  const showInbox = !selectedThread && !showNewThread;
  const showThreadPane = !!selectedThread;
  const showNewPane = showNewThread && !selectedThread;

  return (
    <div className="h-[calc(100dvh-4rem)] flex min-h-0">
      <div
        className={`${showInbox ? "flex" : "hidden md:flex"} min-h-0 min-w-0`}
      >
        <ThreadList
          threads={threads}
          selectedThreadId={selectedThread}
          search={search}
          onSearchChange={setSearch}
          onSelectThread={selectThread}
          onNewThread={openNewThread}
          isLoading={threadsLoading}
          currentUserId={user?.id}
          fieldStaffMode={fieldStaffMode}
        />
      </div>

      {showThreadPane && (
        <div className="flex flex-1 min-h-0 min-w-0">
          <ThreadConversation
            thread={selectedThreadData}
            messages={messages}
            currentUserId={user?.id}
            newMessage={newMessage}
            onNewMessageChange={setNewMessage}
            onSend={() => sendMutation.mutate()}
            isSending={sendMutation.isPending}
            onBack={clearThread}
            onTemplateSelect={handleReplyTemplate}
            templateAudience={fieldStaffMode ? "field" : "clinical"}
          />
          <div ref={messagesEndRef} />
        </div>
      )}

      {showNewPane && (
        <div className="flex flex-1 min-h-0 min-w-0">
          <NewThreadPanel
            fieldStaffMode={fieldStaffMode}
            linkedPatient={linkedPatient}
            onLinkedPatientChange={setLinkedPatient}
            recipientIds={recipientIds}
            onToggleRecipient={toggleRecipient}
            onClearRecipients={() => setRecipientIds([])}
            newSubject={newSubject}
            onNewSubjectChange={setNewSubject}
            newContent={newContent}
            onNewContentChange={setNewContent}
            onSubmit={() => createThreadMutation.mutate()}
            onCancel={() => {
              setShowNewThread(false);
              setLinkedPatient(null);
              setRecipientIds([]);
              updateUrl({ patientId: null });
            }}
            isSubmitting={createThreadMutation.isPending}
            onTemplateSelect={handleNewThreadTemplate}
            members={members}
            currentUserId={user?.id}
            onBack={() => {
              setShowNewThread(false);
              setLinkedPatient(null);
              updateUrl({ patientId: null });
            }}
          />
        </div>
      )}

      {!showThreadPane && !showNewPane && (
        <div className="hidden md:flex flex-1 items-center justify-center bg-slate-50">
          <div className="text-center text-slate-400 px-6">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            <p className="font-medium text-slate-500">Select a conversation</p>
            <p className="text-sm mt-1">
              {fieldStaffMode
                ? "Message a patient's care team"
                : "Choose a thread or start a new one"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100dvh-4rem)] text-slate-500">
          Loading messages…
        </div>
      }
    >
      <MessagesPageContent />
    </Suspense>
  );
}
