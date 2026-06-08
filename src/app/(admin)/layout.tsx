"use client";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LogOut, Shield, LayoutDashboard } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== "owner")) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-3 border-slate-200 border-t-[#028090] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "owner") return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="w-56 flex-shrink-0 flex flex-col bg-slate-900 text-white">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-800">
          <Shield className="w-5 h-5 text-[#028090]" />
          <span className="font-semibold text-sm tracking-wide">Nexovita Admin</span>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {[
            { href: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
            { href: "/admin/agencies", icon: Building2, label: "Agencies", exact: false },
          ].map(({ href, icon: Icon, label, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href) && pathname !== "/admin";
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-slate-800">
          <p className="text-xs text-slate-500 px-3 mb-2 truncate">{user?.email}</p>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center px-8 bg-white border-b border-slate-200 flex-shrink-0">
          <p className="text-sm text-slate-500">
            Platform Admin — <span className="text-slate-800 font-medium">{user?.fullName}</span>
          </p>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
