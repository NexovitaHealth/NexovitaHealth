"use client";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Settings,
  Building2,
  User,
  Bell,
  Shield,
  Save,
  Loader2,
  CheckCircle2,
} from "lucide-react";

type Tab = "profile" | "organization" | "notifications" | "security";

export default function SettingsPage() {
  const { user, activeOrg } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [profile, setProfile] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: "",
    title: "",
    npiNumber: "",
  });

  const [notifications, setNotifications] = useState({
    criticalAlerts: true,
    newMessages: true,
    taskAssigned: true,
    patientAdmission: false,
    weeklyReport: true,
    emailDigest: false,
  });

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 800)); // Simulate API call
    setSaved(true);
    setIsSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
    {
      id: "organization",
      label: "Organization",
      icon: <Building2 className="w-4 h-4" />,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <Bell className="w-4 h-4" />,
    },
    { id: "security", label: "Security", icon: <Shield className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#028090]" /> Settings
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage your account and organization preferences
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                  activeTab === tab.id
                    ? "bg-[#028090] text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === "profile" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-base font-bold text-slate-900 mb-5">
                Personal Information
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Full Name
                    </label>
                    <input
                      value={profile.fullName}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, fullName: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Title / Role
                    </label>
                    <input
                      value={profile.title}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, title: e.target.value }))
                      }
                      placeholder="e.g. RN, MD, Care Manager"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, email: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, phone: e.target.value }))
                      }
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      NPI Number
                    </label>
                    <input
                      value={profile.npiNumber}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, npiNumber: e.target.value }))
                      }
                      placeholder="10-digit NPI"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                    />
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-3">
                    Your role:{" "}
                    <span className="font-medium text-slate-600">
                      {user?.role?.replace(/_/g, " ")}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "organization" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-base font-bold text-slate-900 mb-5">
                Organization Details
              </h2>
              {activeOrg ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Organization Name
                    </label>
                    <input
                      defaultValue={activeOrg.org.name}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      URL Slug
                    </label>
                    <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                      <span className="bg-slate-50 border-r border-slate-200 px-3 py-2.5 text-sm text-slate-400">
                        nexovita.app/
                      </span>
                      <input
                        defaultValue={activeOrg.org.slug}
                        className="flex-1 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                      />
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-slate-600 mb-1">
                      Organization ID
                    </p>
                    <p className="text-xs font-mono text-slate-400">
                      {activeOrg.orgId}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-500 mb-2">
                      Your role in this organization:{" "}
                      <span className="font-semibold text-slate-700">
                        {activeOrg.role?.replace(/_/g, " ")}
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-sm">
                  No organization selected.
                </p>
              )}
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-base font-bold text-slate-900 mb-5">
                Notification Preferences
              </h2>
              <div className="space-y-4">
                {[
                  {
                    key: "criticalAlerts",
                    label: "Critical patient alerts",
                    description:
                      "Immediate notifications for critical vital readings",
                  },
                  {
                    key: "newMessages",
                    label: "New messages",
                    description: "When someone sends you a direct message",
                  },
                  {
                    key: "taskAssigned",
                    label: "Task assignments",
                    description: "When a task is assigned to you",
                  },
                  {
                    key: "patientAdmission",
                    label: "Patient admissions",
                    description: "When a new patient is admitted",
                  },
                  {
                    key: "weeklyReport",
                    label: "Weekly summary report",
                    description: "Agency performance summary every Monday",
                  },
                  {
                    key: "emailDigest",
                    label: "Daily email digest",
                    description: "Morning summary of pending items",
                  },
                ].map(({ key, label, description }) => (
                  <div
                    key={key}
                    className="flex items-start justify-between py-3 border-b border-slate-50 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {label}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {description}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4 mt-0.5">
                      <input
                        type="checkbox"
                        checked={
                          notifications[key as keyof typeof notifications]
                        }
                        onChange={(e) =>
                          setNotifications((p) => ({
                            ...p,
                            [key]: e.target.checked,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-10 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-[#028090]/25 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#028090]"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="text-base font-bold text-slate-900 mb-5">
                  Change Password
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Current Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      New Password
                    </label>
                    <input
                      type="password"
                      placeholder="Min. 8 characters"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="text-base font-bold text-slate-900 mb-1">
                  Active Sessions
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  Manage devices logged into your account
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Current session
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Chrome · Signed in now
                    </p>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-medium">
                    Active
                  </span>
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                <h2 className="text-sm font-bold text-red-800 mb-1">
                  Danger Zone
                </h2>
                <p className="text-xs text-red-600 mb-4">
                  These actions are irreversible. Proceed with caution.
                </p>
                <button className="text-sm font-semibold text-red-600 border border-red-300 hover:border-red-400 hover:bg-red-100 px-4 py-2 rounded-xl transition-colors">
                  Deactivate Account
                </button>
              </div>
            </div>
          )}

          {/* Save button */}
          {activeTab !== "security" && (
            <div className="mt-4 flex items-center justify-end gap-3">
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Saved successfully
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-[#028090] hover:bg-[#026f7c] disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
