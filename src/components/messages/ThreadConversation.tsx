"use client";

import Link from "next/link";
import { getInitials, formatRelative } from "@/lib/utils";
import { ChevronLeft, Loader2, Send, User } from "lucide-react";
import { MessageTemplatePicker } from "@/components/messages/MessageTemplatePicker";
import type { MessageTemplate } from "@/lib/message-templates";
import type { ThreadRow } from "@/components/messages/ThreadList";

type MessageRow = {
  id: string;
  content: string;
  sentAt: string;
  sender?: { id: string; fullName: string };
};

type Props = {
  thread: ThreadRow | undefined;
  messages: MessageRow[];
  currentUserId?: string;
  newMessage: string;
  onNewMessageChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  onBack?: () => void;
  onTemplateSelect: (template: MessageTemplate) => void;
  templateAudience?: "clinical" | "field" | "all";
};

export function ThreadConversation({
  thread,
  messages,
  currentUserId,
  newMessage,
  onNewMessageChange,
  onSend,
  isSending,
  onBack,
  onTemplateSelect,
  templateAudience = "all",
}: Props) {
  const others =
    thread?.participants?.filter((p) => p.id !== currentUserId) || [];
  const headerTitle =
    thread?.subject ||
    others.map((p) => p.fullName).join(", ") ||
    thread?.patient?.fullName ||
    "Conversation";

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-0 min-w-0">
      <div className="bg-white border-b border-slate-200 px-4 md:px-5 py-3 flex items-center gap-3 shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="md:hidden p-2 -ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-600"
            aria-label="Back to conversations"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {thread && (
          <>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#028090] to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {getInitials(
                thread.patient?.fullName || others[0]?.fullName || "GR",
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {headerTitle}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {thread.patient && (
                  <Link
                    href={`/patients/${thread.patient.id}`}
                    className="inline-flex items-center gap-1 text-xs text-[#028090] hover:underline font-medium min-h-[32px]"
                  >
                    <User className="w-3 h-3" />
                    {thread.patient.fullName}
                  </Link>
                )}
                {!thread.patient && (
                  <p className="text-xs text-slate-400">
                    {thread.participants?.length ?? 0} participants
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.sender?.id === currentUserId;
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}
            >
              {!isMe && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                  {getInitials(msg.sender?.fullName || "?")}
                </div>
              )}
              <div
                className={`max-w-[85%] sm:max-w-md flex flex-col gap-1 ${
                  isMe ? "items-end" : "items-start"
                }`}
              >
                {!isMe && (
                  <p className="text-[11px] text-slate-400 px-1">
                    {msg.sender?.fullName}
                  </p>
                )}
                <div
                  className={`px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                    isMe
                      ? "bg-[#028090] text-white rounded-br-md"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-md shadow-sm"
                  }`}
                >
                  {msg.content}
                </div>
                <p
                  className={`text-[11px] text-slate-400 px-1 ${
                    isMe ? "text-right" : ""
                  }`}
                >
                  {formatRelative(msg.sentAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border-t border-slate-200 p-3 md:p-4 space-y-3 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <MessageTemplatePicker
          onSelect={onTemplateSelect}
          audience={templateAudience}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newMessage.trim()) onSend();
          }}
          className="flex gap-2 items-end"
        >
          <textarea
            value={newMessage}
            onChange={(e) => onNewMessageChange(e.target.value)}
            rows={2}
            className="flex-1 px-4 py-3 min-h-[44px] rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] bg-slate-50 resize-none"
            placeholder="Type a message..."
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 bg-[#028090] hover:bg-[#026f7c] disabled:opacity-50 text-white rounded-xl transition-colors shadow-sm shrink-0"
            aria-label="Send message"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
