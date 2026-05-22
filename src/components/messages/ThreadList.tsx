"use client";

import { getInitials, formatRelative } from "@/lib/utils";
import { MessageSquare, Search, Loader2, Plus } from "lucide-react";

export type ThreadRow = {
  id: string;
  subject?: string;
  patient?: { id: string; fullName: string } | null;
  participants?: Array<{ id: string; fullName: string }>;
  lastMessage?: string;
  updatedAt: string;
  unreadCount?: number;
};

type Props = {
  threads: ThreadRow[];
  selectedThreadId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  isLoading: boolean;
  currentUserId?: string;
  fieldStaffMode?: boolean;
};

export function ThreadList({
  threads,
  selectedThreadId,
  search,
  onSearchChange,
  onSelectThread,
  onNewThread,
  isLoading,
  currentUserId,
  fieldStaffMode,
}: Props) {
  const filtered = threads.filter(
    (t) =>
      !search ||
      t.subject?.toLowerCase().includes(search.toLowerCase()) ||
      t.patient?.fullName.toLowerCase().includes(search.toLowerCase()) ||
      t.participants?.some((p) =>
        p.fullName.toLowerCase().includes(search.toLowerCase()),
      ),
  );

  return (
    <div className="w-full md:w-80 md:flex-shrink-0 border-r border-slate-200 bg-white flex flex-col min-h-0">
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Messages</h2>
            {fieldStaffMode && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                Your assigned patients only
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onNewThread}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
            title="New conversation"
            aria-label="New conversation"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 min-h-[44px] rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] bg-slate-50"
            placeholder="Search conversations..."
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 px-4">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 text-slate-200" />
            <p className="text-sm font-medium text-slate-500">
              No conversations yet
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {fieldStaffMode
                ? "Message your patient's care team"
                : "Start a new conversation"}
            </p>
          </div>
        ) : (
          filtered.map((thread) => {
            const other =
              thread.participants?.filter((p) => p.id !== currentUserId) || [];
            const isSelected = selectedThreadId === thread.id;
            const title =
              thread.patient?.fullName ||
              thread.subject ||
              other.map((p) => p.fullName).join(", ") ||
              "Conversation";

            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => onSelectThread(thread.id)}
                className={`w-full text-left px-4 py-3.5 min-h-[72px] border-b border-slate-50 transition-colors ${
                  isSelected ? "bg-teal-50" : "hover:bg-slate-50 active:bg-slate-100"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#028090] to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {thread.patient
                      ? getInitials(thread.patient.fullName)
                      : other.length > 0
                        ? getInitials(other[0].fullName)
                        : "GR"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-sm font-semibold truncate ${
                          isSelected ? "text-teal-800" : "text-slate-900"
                        }`}
                      >
                        {title}
                      </p>
                      {!!thread.unreadCount && thread.unreadCount > 0 && (
                        <span className="bg-[#028090] text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold flex-shrink-0">
                          {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
                        </span>
                      )}
                    </div>
                    {thread.patient && thread.subject && (
                      <p className="text-[11px] text-[#028090] font-medium truncate mt-0.5">
                        {thread.patient.fullName}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {thread.lastMessage || "No messages yet"}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
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
  );
}
