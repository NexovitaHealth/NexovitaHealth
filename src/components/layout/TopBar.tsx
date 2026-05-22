"use client";
import { Bell, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

async function fetchUnreadCount() {
  const res = await fetch("/api/notifications?pageSize=1&isRead=false", {
    credentials: "include",
  });
  if (!res.ok) return 0;
  return parseInt(res.headers.get("X-Notification-Unread-Count") || "0", 10);
}

export function TopBar() {
  const { user } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notification-unread"],
    queryFn: fetchUnreadCount,
    refetchInterval: 60_000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (q) router.push(`/patients?search=${encodeURIComponent(q)}`);
    else router.push("/patients");
  };

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 flex-shrink-0">
      <form onSubmit={handleSearch} className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search patients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#028090]/20 focus:border-[#028090] focus:bg-white transition-all"
        />
      </form>

      <div className="flex items-center gap-3">
        <Link
          href="/notifications"
          className="relative p-2 rounded-xl hover:bg-slate-50 transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4 text-slate-500" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-2 pl-3 border-l border-slate-100">
          <div className="w-7 h-7 rounded-full bg-[#028090]/10 flex items-center justify-center">
            <span className="text-[#028090] text-xs font-bold">
              {user?.fullName?.charAt(0)}
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800">
              {user?.fullName?.split(" ")[0]}
            </p>
            <p className="text-[10px] text-slate-400 capitalize">
              {user?.role?.replace(/_/g, " ")}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
