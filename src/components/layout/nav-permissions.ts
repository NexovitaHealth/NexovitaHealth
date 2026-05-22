import type { Permission } from "@/lib/permissions";

export type NavItemConfig = {
  href: string;
  label: string;
  permission?: Permission;
};

/** Sidebar items gated by central permission matrix. */
export const NAV_ITEMS: NavItemConfig[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/patients", label: "Patients", permission: "patient:read" },
  { href: "/projects", label: "Projects", permission: "task:read" },
  { href: "/tasks", label: "Tasks", permission: "task:read" },
  { href: "/schedule", label: "Schedule", permission: "visit:read" },
  { href: "/my-visits", label: "My Visits", permission: "visit:checkin" },
  { href: "/supervisor", label: "Supervisor Panel", permission: "clinical:supervise" },
  { href: "/visit-review", label: "Visit Review", permission: "review:decide" },
  {
    href: "/physician-orders",
    label: "Physician Orders",
    permission: "physician_order:manage",
  },
  { href: "/escalations", label: "Escalations", permission: "escalation:read" },
  { href: "/incidents", label: "Incidents", permission: "incident:read" },
  { href: "/alerts", label: "Clinical Alerts", permission: "alert:read" },
  { href: "/vitals", label: "Vitals Monitor", permission: "vital:read" },
  { href: "/labs", label: "Lab Results", permission: "lab:read" },
  { href: "/messages", label: "Messages", permission: "task:read" },
  { href: "/notifications", label: "Notifications" },
  { href: "/billing", label: "Billing", permission: "billing:manage" },
  { href: "/reports", label: "Reports", permission: "report:view" },
  { href: "/team", label: "Team", permission: "patient:read" },
  {
    href: "/family-caregivers",
    label: "Family Caregivers",
    permission: "caregiver:manage",
  },
  { href: "/audit", label: "Audit Log", permission: "audit:read" },
  { href: "/settings", label: "Settings" },
];
