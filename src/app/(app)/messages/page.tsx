"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { getInitials, formatRelative } from "@/lib/utils";
import { MessageSquare, Send, Search, Loader2, Plus } from "lucide-react";

export default function MessagesPage() {
  const { request, orgId } = useApi();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newContent, setNewContent] = useState("");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [newPatientId, setNewPatientId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: membersData } = useQuery({
    queryKey: ["members", orgId],
    queryFn: () => request("/api/orgs/{orgId}/members"),
    enabled: !!orgId && showNewThread,
  });

  const members = (membersData?.data as Array<{ id: string; fullName: string }>) || [];

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
          patientId: newPatientId || undefined,
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
      setNewPatientId("");
      if (threadId) setSelectedThread(threadId);
    },
  });

  const toggleRecipient = (id: string) => {
    setRecipientIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData]);

  const threads = (threadsData?.data ?? []) as Array<{
    id: string;
    subject?: string;
    participants?: Array<{ id: string; fullName: string }>;
    lastMessage?: string;
    updatedAt: string;
    unreadCount?: number;
  }>;
  const messages = (messagesData?.data ?? []) as Array<{
    id: string;
    content: string;
    sentAt: string;
    isRead: boolean;
    sender?: { id: string; fullName: string };
  }>;

  const filteredThreads = threads.filter(
    (t: { subject?: string; participants?: Array<{ fullName: string }> }) =>
      !search ||
      t.subject?.toLowerCase().includes(search.toLowerCase()) ||
      t.participants?.some((p: { fullName: string }) =>
        p.fullName.toLowerCase().includes(search.toLowerCase()),
      ),
  );

  const selectedThreadData = threads.find(
    (t: { id: string }) => t.id === selectedThread,
  );

  return (
    <div className="h-[calc(100vh-56px)] flex">
      {/* Thread list */}
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
            filteredThreads.map(
              (thread: {
                id: string;
                subject?: string;
                lastMessage?: string;
                updatedAt: string;
                unreadCount?: number;
                participants?: Array<{ id: string; fullName: string }>;
              }) => {
                const other =
                  thread.participants?.filter(
                    (p: { id: string }) => p.id !== user?.id,
                  ) || [];
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
                        <div className="flex items-center justify-between">
                          <p
                            className={`text-xs font-semibold truncate ${isSelected ? "text-teal-800" : "text-slate-900"}`}
                          >
                            {thread.subject ||
                              other
                                .map((p: { fullName: string }) => p.fullName)
                                .join(", ") ||
                              "Group"}
                          </p>
                          {thread.unreadCount && thread.unreadCount > 0 && (
                            <span className="ml-1 bg-[#028090] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold flex-shrink-0">
                              {thread.unreadCount}
                            </span>
                          )}
                        </div>
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
              },
            )
          )}
        </div>
      </div>

      {/* Chat area */}
      {selectedThread ? (
        <div className="flex-1 flex flex-col bg-slate-50">
          {/* Header */}
          <div className="bg-white border-b border-slate-200 px-5 py-3.5 flex items-center gap-3">
            {selectedThreadData && (
              <>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#028090] to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                  {getInitials(
                    selectedThreadData.participants?.filter(
                      (p: { id: string }) => p.id !== user?.id,
                    )?.[0]?.fullName || "GR",
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedThreadData.subject ||
                      selectedThreadData.participants
                        ?.filter((p: { id: string }) => p.id !== user?.id)
                        .map((p: { fullName: string }) => p.fullName)
                        .join(", ")}
                  </p>
                  <p className="text-xs text-slate-400">
                    {selectedThreadData.participants?.length} participants
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map(
              (msg: {
                id: string;
                content: string;
                sentAt: string;
                isRead: boolean;
                sender?: { id: string; fullName: string };
              }) => {
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
                        className={`px-4 py-2.5 rounded-2xl text-sm ${
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
              },
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Compose */}
          <div className="bg-white border-t border-slate-200 p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newMessage.trim()) sendMutation.mutate();
              }}
              className="flex gap-3"
            >
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] bg-slate-50"
                placeholder="Type a message..."
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sendMutation.isPending}
                className="flex items-center justify-center w-10 h-10 bg-[#028090] hover:bg-[#026f7c] disabled:opacity-50 text-white rounded-xl transition-colors shadow-sm"
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
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Subject (optional)"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
            <input
              value={newPatientId}
              onChange={(e) => setNewPatientId(e.target.value)}
              placeholder="Patient ID (optional UUID)"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
            />
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
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm min-h-[120px]"
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
                onClick={() => setShowNewThread(false)}
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
