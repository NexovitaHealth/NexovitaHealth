"use client";
import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { UniversalSearch } from "@/components/search/UniversalSearch";
import { PatientListFilters } from "@/components/patients/PatientListFilters";

async function fetchUnreadCount() {
  const res = await fetch("/api/notifications?pageSize=1&isRead=false", {
    credentials: "include",
  });
  if (!res.ok) return 0;
  return parseInt(res.headers.get("X-Notification-Unread-Count") || "0", 10);
}

function TopBarContent() {
  const { user } = useAuth();
  const pathname = usePathname();
  const isPatientsPage = pathname === "/patients";

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notification-unread"],
    queryFn: fetchUnreadCount,
    refetchInterval: 60_000,
  });

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 flex-shrink-0 gap-4">
      <div className="flex flex-1 min-w-0 items-center gap-3">
        <UniversalSearch
          className={
            isPatientsPage
              ? "relative flex-1 min-w-0 max-w-md"
              : "relative w-80 shrink-0"
          }
        />
        {isPatientsPage && (
          <PatientListFilters
            className="hidden md:flex items-center gap-3 shrink-0"
            selectClassName="input-base w-36 text-sm py-2"
          />
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
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
          <div className="hidden sm:block">
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

export function TopBar() {
  return (
    <Suspense fallback={<header className="h-16 bg-white border-b border-slate-100" />}>
      <TopBarContent />
    </Suspense>
  );
}
