"use client";
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { getInitials, formatRelative } from "@/lib/utils";
import { MessageSquare, Send, Search, Loader2, Plus, User } from "lucide-react";
import { PatientMessagePicker } from "@/components/messages/PatientMessagePicker";
import { MessageTemplatePicker } from "@/components/messages/MessageTemplatePicker";
import type { MessageTemplate } from "@/lib/message-templates";

type PatientOption = { id: string; fullName: string };

type ThreadRow = {
  id: string;
  subject?: string;
  patient?: PatientOption | null;
  participants?: Array<{ id: string; fullName: string }>;
  lastMessage?: string;
  updatedAt: string;
  unreadCount?: number;
};

function applyTemplateBody(current: string, template: MessageTemplate) {
  if (!current.trim()) return template.body;
  return `${current.trim()}\n\n${template.body}`;
}

export default function MessagesPage() {
  const { request, orgId } = useApi();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newContent, setNewContent] = useState("");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [linkedPatient, setLinkedPatient] = useState<PatientOption | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: membersData } = useQuery({
    queryKey: ["members", orgId],
    queryFn: () => request("/api/orgs/{orgId}/members"),
    enabled: !!orgId && showNewThread,
  });

  const members =
    (membersData?.data as Array<{ id: string; fullName: string }>) || [];

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
        }
      } catch {
        /* patient not found or no access */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, orgId, request]);

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
      if (threadId) setSelectedThread(threadId);
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
    isRead: boolean;
    sender?: { id: string; fullName: string };
  }>;

  const filteredThreads = threads.filter(
    (t) =>
      !search ||
      t.subject?.toLowerCase().includes(search.toLowerCase()) ||
      t.patient?.fullName.toLowerCase().includes(search.toLowerCase()) ||
      t.participants?.some((p) =>
        p.fullName.toLowerCase().includes(search.toLowerCase()),
      ),
  );

  const selectedThreadData = threads.find((t) => t.id === selectedThread);

  return (
    <div className="h-[calc(100vh-56px)] flex">
      <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">Messages</h2>
            <button
              type="button"
              onClick={() => setShowNewThread(true)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
              title="New conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] bg-slate-50"
              placeholder="Search messages..."
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threadsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="text-center py-12 text-slate-400 px-4">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-200" />
              <p className="text-xs font-medium text-slate-500">
                No conversations yet
              </p>
            </div>
          ) : (
            filteredThreads.map((thread) => {
              const other =
                thread.participants?.filter((p) => p.id !== user?.id) || [];
              const isSelected = selectedThread === thread.id;
              return (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThread(thread.id)}
                  className={`w-full text-left px-4 py-3.5 border-b border-slate-50 transition-colors ${isSelected ? "bg-teal-50" : "hover:bg-slate-50"}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#028090] to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                      {other.length > 0
                        ? getInitials(other[0].fullName)
                        : "GR"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={`text-xs font-semibold truncate ${isSelected ? "text-teal-800" : "text-slate-900"}`}
                        >
                          {thread.subject ||
                            other.map((p) => p.fullName).join(", ") ||
                            "Group"}
                        </p>
                        {thread.unreadCount && thread.unreadCount > 0 && (
                          <span className="bg-[#028090] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold flex-shrink-0">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                      {thread.patient && (
                        <p className="text-[10px] text-[#028090] font-medium truncate mt-0.5">
                          {thread.patient.fullName}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {thread.lastMessage || "No messages yet"}
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {formatRelative(thread.updatedAt)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {selectedThread ? (
        <div className="flex-1 flex flex-col bg-slate-50">
          <div className="bg-white border-b border-slate-200 px-5 py-3.5 flex items-center gap-3">
            {selectedThreadData && (
              <>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#028090] to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                  {getInitials(
                    selectedThreadData.participants?.filter(
                      (p) => p.id !== user?.id,
                    )?.[0]?.fullName || "GR",
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {selectedThreadData.subject ||
                      selectedThreadData.participants
                        ?.filter((p) => p.id !== user?.id)
                        .map((p) => p.fullName)
                        .join(", ")}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-slate-400">
                      {selectedThreadData.participants?.length} participants
                    </p>
                    {selectedThreadData.patient && (
                      <Link
                        href={`/patients/${selectedThreadData.patient.id}`}
                        className="inline-flex items-center gap-1 text-xs text-[#028090] hover:underline font-medium"
                      >
                        <User className="w-3 h-3" />
                        {selectedThreadData.patient.fullName}
                      </Link>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((msg) => {
              const isMe = msg.sender?.id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}
                >
                  {!isMe && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {getInitials(msg.sender?.fullName || "?")}
                    </div>
                  )}
                  <div
                    className={`max-w-xs lg:max-w-md ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}
                  >
                    {!isMe && (
                      <p className="text-xs text-slate-400 px-1">
                        {msg.sender?.fullName}
                      </p>
                    )}
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                        isMe
                          ? "bg-[#028090] text-white rounded-br-md"
                          : "bg-white text-slate-800 border border-slate-200 rounded-bl-md shadow-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <p
                      className={`text-xs text-slate-400 px-1 ${isMe ? "text-right" : ""}`}
                    >
                      {formatRelative(msg.sentAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="bg-white border-t border-slate-200 p-4 space-y-3">
            <MessageTemplatePicker onSelect={handleReplyTemplate} />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newMessage.trim()) sendMutation.mutate();
              }}
              className="flex gap-3"
            >
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={2}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] bg-slate-50 resize-none"
                placeholder="Type a message..."
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sendMutation.isPending}
                className="flex items-center justify-center w-10 h-10 bg-[#028090] hover:bg-[#026f7c] disabled:opacity-50 text-white rounded-xl transition-colors shadow-sm self-end"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      ) : showNewThread ? (
        <div className="flex-1 flex flex-col bg-slate-50 p-6 overflow-y-auto">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            New conversation
          </h2>
          <div className="max-w-lg space-y-4">
            <MessageTemplatePicker onSelect={handleNewThreadTemplate} />
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Subject (optional)"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">
                Link to patient (optional)
              </p>
              <PatientMessagePicker
                value={linkedPatient}
                onChange={setLinkedPatient}
              />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Recipients</p>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {members
                  .filter((m) => m.id !== user?.id)
                  .map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleRecipient(m.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                        recipientIds.includes(m.id)
                          ? "bg-[#028090] text-white border-[#028090]"
                          : "bg-white border-slate-200 text-slate-600"
                      }`}
                    >
                      {m.fullName}
                    </button>
                  ))}
              </div>
            </div>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="First message..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm min-h-[140px] resize-y"
              required
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => createThreadMutation.mutate()}
                disabled={
                  createThreadMutation.isPending ||
                  !newContent.trim() ||
                  recipientIds.length === 0
                }
                className="px-4 py-2 rounded-lg bg-[#028090] text-white text-sm font-medium disabled:opacity-50"
              >
                Start conversation
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewThread(false);
                  setLinkedPatient(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="text-center text-slate-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            <p className="font-medium text-slate-500">Select a conversation</p>
            <p className="text-sm mt-1">
              Choose a thread or start a new one
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
