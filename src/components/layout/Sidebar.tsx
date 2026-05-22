"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  ClipboardList,
  ClipboardCheck,
  AlertTriangle,
  FileWarning,
  FileSignature,
  Settings,
  Bell,
  Activity,
  FileText,
  Calendar,
  CalendarCheck,
  DollarSign,
  Heart,
  UserCheck,
  LogOut,
  ChevronDown,
  Building2,
  FlaskConical,
  BarChart3,
  MessageSquare,
  Shield,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { NAV_ITEMS } from "@/components/layout/nav-permissions";
import {
  isPhysicianPortalRole,
  PHYSICIAN_NAV_HREFS,
} from "@/lib/physician-nav";

const NAV_ICONS: Record<string, React.ElementType> = {
  "/physician": Stethoscope,
  "/dashboard": LayoutDashboard,
  "/patients": Users,
  "/projects": FolderKanban,
  "/tasks": ClipboardList,
  "/schedule": Calendar,
  "/my-visits": CalendarCheck,
  "/compliance": ShieldCheck,
  "/supervisor": Shield,
  "/visit-review": ClipboardCheck,
  "/care-plans": ClipboardList,
  "/physician-orders": FileSignature,
  "/alerts": Activity,
  "/escalations": AlertTriangle,
  "/incidents": FileWarning,
  "/vitals": Activity,
  "/labs": FlaskConical,
  "/messages": MessageSquare,
  "/notifications": Bell,
  "/billing": DollarSign,
  "/reports": BarChart3,
  "/team": Heart,
  "/family-caregivers": UserCheck,
  "/audit": Shield,
  "/settings": Settings,
};

export function Sidebar() {
  const { user, activeOrg, logout, setActiveOrg } = useAuth();
  const { can } = usePermissions();
  const pathname = usePathname();
  const [orgDropdown, setOrgDropdown] = useState(false);

  const physicianMode = isPhysicianPortalRole(user?.role);

  const filteredNav = NAV_ITEMS.filter((item) => {
    if (item.permission && !can(item.permission)) return false;
    if (physicianMode) {
      if (item.href === "/dashboard") return false;
      return PHYSICIAN_NAV_HREFS.has(item.href);
    }
    if (item.href === "/physician") return false;
    return true;
  });

  return (
    <aside className="w-64 bg-white border-r border-slate-100 flex flex-col h-screen fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="h-16 px-6 flex items-center border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#028090] flex items-center justify-center">
            <Heart className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 tracking-tight">
              Nexovita
            </div>
            <div className="text-xs text-slate-400">Health Platform</div>
          </div>
        </div>
      </div>

      {/* Org Switcher */}
      {user && user.orgMemberships.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-100">
          <button
            onClick={() => setOrgDropdown(!orgDropdown)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors group"
          >
            <div className="w-7 h-7 rounded-lg bg-[#028090]/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-[#028090]" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-xs font-semibold text-slate-800 truncate">
                {activeOrg?.org.name || "Select Org"}
              </div>
              <div className="text-[10px] text-slate-400 capitalize">
                {activeOrg?.role}
              </div>
            </div>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-slate-400 transition-transform",
                orgDropdown && "rotate-180",
              )}
            />
          </button>

          {orgDropdown && user.orgMemberships.length > 1 && (
            <div className="mt-1 bg-slate-50 rounded-xl overflow-hidden">
              {user.orgMemberships.map((m) => (
                <button
                  key={m.orgId}
                  onClick={() => {
                    setActiveOrg(m.orgId);
                    setOrgDropdown(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs hover:bg-white transition-colors",
                    m.orgId === activeOrg?.orgId &&
                      "bg-white font-medium text-[#028090]",
                  )}
                >
                  {m.org.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {filteredNav.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = NAV_ICONS[item.href] ?? LayoutDashboard;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150",
                isActive
                  ? "bg-[#028090] text-white shadow-sm shadow-[#028090]/20"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  isActive ? "text-white" : "text-slate-400",
                )}
              />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#028090]/10 flex items-center justify-center flex-shrink-0">
            <span className="text-[#028090] text-xs font-bold">
              {user?.fullName?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-800 truncate">
              {user?.fullName}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {user?.email}
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
