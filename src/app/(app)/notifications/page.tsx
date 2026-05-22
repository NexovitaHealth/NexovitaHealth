"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { formatRelative } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  isRead: boolean;
  createdAt: string;
};

async function fetchNotifications(isRead?: boolean) {
  const params = new URLSearchParams({ pageSize: "50" });
  if (isRead !== undefined) params.set("isRead", String(isRead));
  const res = await fetch(`/api/notifications?${params}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to load notifications");
  return {
    items: json.data as Notification[],
    unread: parseInt(res.headers.get("X-Notification-Unread-Count") || "0", 10),
  };
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", filter],
    queryFn: () =>
      fetchNotifications(filter === "unread" ? false : undefined),
  });

  const markRead = useMutation({
    mutationFn: (notificationId: string) =>
      fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isRead: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notification-unread"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isRead: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notification-unread"] });
    },
  });

  const items = data?.items ?? [];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#028090]" />
            Notifications
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {data?.unread ?? 0} unread
          </p>
        </div>
        <button
          type="button"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || !data?.unread}
          className="inline-flex items-center gap-2 text-sm text-[#028090] font-medium disabled:opacity-50"
        >
          <CheckCheck className="w-4 h-4" />
          Mark all read
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              filter === f
                ? "bg-[#028090] text-white"
                : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {f === "all" ? "All" : "Unread"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12">No notifications.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border p-4 ${
                n.isRead
                  ? "bg-white border-slate-100"
                  : "bg-teal-50/50 border-teal-100"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 text-sm">{n.title}</p>
                  <p className="text-sm text-slate-600 mt-0.5">{n.body}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {formatRelative(n.createdAt)} · {n.type}
                  </p>
                  {n.actionUrl && (
                    <Link
                      href={n.actionUrl}
                      className="inline-block mt-2 text-xs font-medium text-[#028090] hover:underline"
                    >
                      Open
                    </Link>
                  )}
                </div>
                {!n.isRead && (
                  <button
                    type="button"
                    onClick={() => markRead.mutate(n.id)}
                    className="text-xs text-slate-500 hover:text-[#028090] whitespace-nowrap"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
