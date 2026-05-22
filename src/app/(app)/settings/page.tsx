"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { orgApi, settings as settingsApi } from "@/lib/api-client";
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
  const { user, activeOrg, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [emailStatusFilter, setEmailStatusFilter] = useState("");
  const isAgencyAdmin = user?.role === "agency_admin";

  const [profile, setProfile] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: "",
    title: "",
    npiNumber: "",
  });

  const [organization, setOrganization] = useState({
    name: activeOrg?.org.name || "",
    slug: activeOrg?.org.slug || "",
    address: "",
    city: "",
    region: "",
    phone: "",
    email: "",
    website: "",
    medicareProviderNumber: "",
    npiNumber: "",
    checkinTime: "07:30",
    summaryTime: "20:00",
    nationalHealthSystem: "",
    primaryCareSetting: "",
    supervisingNurse: "",
  });

  const [medicaidEvv, setMedicaidEvv] = useState({
    medicaidProviderId: "",
    officeId: "",
    payerId: "",
    stateCode: "",
    defaultServiceCode: "S5135",
    timezone: "America/Chicago",
  });

  const [notifications, setNotifications] = useState({
    criticalAlerts: true,
    newMessages: true,
    taskAssigned: true,
    patientAdmission: false,
    weeklyReport: true,
    emailDigest: false,
  });

  const { data: profileData } = useQuery({
    queryKey: ["settings", "profile"],
    queryFn: () => settingsApi.get(),
  });

  const { data: orgSettingsData } = useQuery({
    queryKey: ["settings", "org", activeOrg?.orgId],
    queryFn: () => orgApi(activeOrg!.orgId).settings.get(),
    enabled: !!activeOrg?.orgId,
  });

  const { data: evvSettingsData } = useQuery({
    queryKey: ["evv-settings", activeOrg?.orgId],
    queryFn: () => orgApi(activeOrg!.orgId).evv.settings.get(),
    enabled: !!activeOrg?.orgId && isAgencyAdmin,
  });

  const { data: emailDeliveriesData, isLoading: emailDeliveriesLoading } =
    useQuery({
      queryKey: ["email-deliveries", activeOrg?.orgId, emailStatusFilter],
      queryFn: () =>
        orgApi(activeOrg!.orgId).emailDeliveries.list({
          pageSize: 30,
          status: emailStatusFilter || undefined,
        }),
      enabled: !!activeOrg?.orgId && isAgencyAdmin && activeTab === "security",
    });

  const retryEmailMutation = useMutation({
    mutationFn: (deliveryId: string) =>
      orgApi(activeOrg!.orgId).emailDeliveries.retry(deliveryId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["email-deliveries"] }),
  });

  const profileMutation = useMutation({
    mutationFn: () =>
      settingsApi.update({
        fullName: profile.fullName,
        phone: profile.phone || null,
        licenseType: profile.title || null,
        npiNumber: profile.npiNumber || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "profile"] });
      await refresh();
    },
  });

  const evvMutation = useMutation({
    mutationFn: () => orgApi(activeOrg!.orgId).evv.settings.update(medicaidEvv),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["evv-settings"] }),
  });

  const orgMutation = useMutation({
    mutationFn: () =>
      orgApi(activeOrg!.orgId).settings.update({
        organization: {
          name: organization.name,
          address: organization.address || null,
          city: organization.city || null,
          region: organization.region || null,
          phone: organization.phone || null,
          email: organization.email || null,
          website: organization.website || null,
          medicareProviderNumber: organization.medicareProviderNumber || null,
          npiNumber: organization.npiNumber || null,
        },
        settings: {
          checkinTime: organization.checkinTime,
          summaryTime: organization.summaryTime,
          nationalHealthSystem: organization.nationalHealthSystem || null,
          primaryCareSetting: organization.primaryCareSetting || null,
          supervisingNurse: organization.supervisingNurse || null,
          notificationPreferences: notifications,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["settings", "org", activeOrg?.orgId],
      });
      await refresh();
    },
  });

  useEffect(() => {
    const loadedProfile = profileData?.profile;
    if (!loadedProfile) return;
    setProfile({
      fullName: loadedProfile.fullName || "",
      email: loadedProfile.email || "",
      phone: loadedProfile.phone || "",
      title: loadedProfile.licenseType || "",
      npiNumber: loadedProfile.npiNumber || "",
    });
  }, [profileData]);

  useEffect(() => {
    const loadedOrg = orgSettingsData?.organization;
    if (!loadedOrg) return;

    const prefs = loadedOrg.settings?.features?.notificationPreferences || {};
    setOrganization({
      name: loadedOrg.name || "",
      slug: loadedOrg.slug || "",
      address: loadedOrg.address || "",
      city: loadedOrg.city || "",
      region: loadedOrg.region || "",
      phone: loadedOrg.phone || "",
      email: loadedOrg.email || "",
      website: loadedOrg.website || "",
      medicareProviderNumber: loadedOrg.medicareProviderNumber || "",
      npiNumber: loadedOrg.npiNumber || "",
      checkinTime: loadedOrg.settings?.checkinTime || "07:30",
      summaryTime: loadedOrg.settings?.summaryTime || "20:00",
      nationalHealthSystem: loadedOrg.settings?.nationalHealthSystem || "",
      primaryCareSetting: loadedOrg.settings?.primaryCareSetting || "",
      supervisingNurse: loadedOrg.settings?.supervisingNurse || "",
    });
    setNotifications((current) => ({ ...current, ...prefs }));
  }, [orgSettingsData]);

  useEffect(() => {
    const loaded = evvSettingsData?.medicaidEvv as
      | Record<string, string>
      | undefined;
    if (!loaded) return;
    setMedicaidEvv((current) => ({
      ...current,
      medicaidProviderId: loaded.medicaidProviderId ?? "",
      officeId: loaded.officeId ?? "",
      payerId: loaded.payerId ?? "",
      stateCode: loaded.stateCode ?? "",
      defaultServiceCode: loaded.defaultServiceCode ?? "S5135",
      timezone: loaded.timezone ?? "America/Chicago",
    }));
  }, [evvSettingsData]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      if (activeTab === "profile") {
        await profileMutation.mutateAsync();
      }
      if (activeTab === "organization" || activeTab === "notifications") {
        await orgMutation.mutateAsync();
        if (activeTab === "organization" && isAgencyAdmin) {
          await evvMutation.mutateAsync();
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
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
                    readOnly
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
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
                      value={organization.name}
                      onChange={(e) =>
                        setOrganization((current) => ({
                          ...current,
                          name: e.target.value,
                        }))
                      }
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
                        value={organization.slug}
                        readOnly
                        className="flex-1 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Phone
                      </label>
                      <input
                        value={organization.phone}
                        onChange={(e) =>
                          setOrganization((current) => ({
                            ...current,
                            phone: e.target.value,
                          }))
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Email
                      </label>
                      <input
                        type="email"
                        value={organization.email}
                        onChange={(e) =>
                          setOrganization((current) => ({
                            ...current,
                            email: e.target.value,
                          }))
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Address
                    </label>
                    <input
                      value={organization.address}
                      onChange={(e) =>
                        setOrganization((current) => ({
                          ...current,
                          address: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Check-in Time
                      </label>
                      <input
                        type="time"
                        value={organization.checkinTime}
                        onChange={(e) =>
                          setOrganization((current) => ({
                            ...current,
                            checkinTime: e.target.value,
                          }))
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Daily Summary Time
                      </label>
                      <input
                        type="time"
                        value={organization.summaryTime}
                        onChange={(e) =>
                          setOrganization((current) => ({
                            ...current,
                            summaryTime: e.target.value,
                          }))
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                      />
                    </div>
                  </div>
                  {isAgencyAdmin && (
                    <div className="border border-teal-100 rounded-xl p-4 bg-teal-50/40 space-y-3">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Medicaid EVV export
                      </h3>
                      <p className="text-xs text-slate-500">
                        Used for Sandata-aligned CSV files from Schedule → EVV
                        export. Member ID defaults to patient insurance number.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Medicaid provider ID
                          </label>
                          <input
                            value={medicaidEvv.medicaidProviderId}
                            onChange={(e) =>
                              setMedicaidEvv((c) => ({
                                ...c,
                                medicaidProviderId: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                            placeholder="State Medicaid provider ID"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Office ID
                          </label>
                          <input
                            value={medicaidEvv.officeId}
                            onChange={(e) =>
                              setMedicaidEvv((c) => ({
                                ...c,
                                officeId: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Payer ID
                          </label>
                          <input
                            value={medicaidEvv.payerId}
                            onChange={(e) =>
                              setMedicaidEvv((c) => ({
                                ...c,
                                payerId: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            State code
                          </label>
                          <input
                            value={medicaidEvv.stateCode}
                            onChange={(e) =>
                              setMedicaidEvv((c) => ({
                                ...c,
                                stateCode: e.target.value.toUpperCase().slice(0, 2),
                              }))
                            }
                            maxLength={2}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                            placeholder="TX"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Default service code
                          </label>
                          <input
                            value={medicaidEvv.defaultServiceCode}
                            onChange={(e) =>
                              setMedicaidEvv((c) => ({
                                ...c,
                                defaultServiceCode: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                            placeholder="S5135"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Timezone
                          </label>
                          <input
                            value={medicaidEvv.timezone}
                            onChange={(e) =>
                              setMedicaidEvv((c) => ({
                                ...c,
                                timezone: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                            placeholder="America/Chicago"
                          />
                        </div>
                      </div>
                    </div>
                  )}
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
              <form
                className="bg-white rounded-2xl border border-slate-200 p-6"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setPasswordMsg(null);
                  if (passwordForm.next !== passwordForm.confirm) {
                    setPasswordMsg("New passwords do not match");
                    return;
                  }
                  setPasswordSaving(true);
                  try {
                    const res = await fetch("/api/auth/change-password", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        currentPassword: passwordForm.current,
                        newPassword: passwordForm.next,
                      }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || "Update failed");
                    setPasswordForm({ current: "", next: "", confirm: "" });
                    setPasswordMsg("Password updated");
                  } catch (err) {
                    setPasswordMsg(
                      err instanceof Error ? err.message : "Update failed",
                    );
                  } finally {
                    setPasswordSaving(false);
                  }
                }}
              >
                <h2 className="text-base font-bold text-slate-900 mb-5">
                  Change Password
                </h2>
                {passwordMsg && (
                  <p
                    className={`text-sm mb-4 ${passwordMsg === "Password updated" ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {passwordMsg}
                  </p>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Current Password
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordForm.current}
                      onChange={(e) =>
                        setPasswordForm((p) => ({ ...p, current: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={passwordForm.next}
                      onChange={(e) =>
                        setPasswordForm((p) => ({ ...p, next: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordForm.confirm}
                      onChange={(e) =>
                        setPasswordForm((p) => ({
                          ...p,
                          confirm: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="mt-5 px-4 py-2 rounded-xl bg-[#028090] text-white text-sm font-medium disabled:opacity-50"
                >
                  {passwordSaving ? "Updating…" : "Update password"}
                </button>
              </form>
              {isAgencyAdmin && activeOrg?.orgId && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h2 className="text-base font-bold text-slate-900 mb-1">
                    Email delivery log
                  </h2>
                  <p className="text-xs text-slate-400 mb-4">
                    Outbound mail status, bounces, and manual retries
                  </p>
                  <div className="flex gap-2 mb-4">
                    {[
                      ["", "All"],
                      ["sent", "Sent"],
                      ["queued", "Queued"],
                      ["failed", "Failed"],
                      ["bounced", "Bounced"],
                    ].map(([value, label]) => (
                      <button
                        key={value || "all"}
                        type="button"
                        onClick={() => setEmailStatusFilter(value)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          emailStatusFilter === value
                            ? "bg-[#028090] text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {emailDeliveriesLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-[#028090]" />
                  ) : (
                    <ul className="space-y-2 max-h-80 overflow-y-auto">
                      {(
                        (emailDeliveriesData as { items?: Array<{
                          id: string;
                          to: string;
                          subject: string;
                          template: string;
                          status: string;
                          attempts: number;
                          lastError: string | null;
                          createdAt: string;
                        }> })?.items ?? []
                      ).map((row) => (
                        <li
                          key={row.id}
                          className="border border-slate-100 rounded-xl px-3 py-2 text-sm"
                        >
                          <div className="flex justify-between gap-2">
                            <span className="font-medium truncate">{row.to}</span>
                            <span className="text-xs capitalize text-slate-500">
                              {row.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {row.subject}
                          </p>
                          {row.lastError && (
                            <p className="text-xs text-red-600 mt-1 truncate">
                              {row.lastError}
                            </p>
                          )}
                          {["queued", "failed"].includes(row.status) && (
                            <button
                              type="button"
                              disabled={retryEmailMutation.isPending}
                              onClick={() => retryEmailMutation.mutate(row.id)}
                              className="mt-2 text-xs text-[#028090] font-medium"
                            >
                              Retry send
                            </button>
                          )}
                        </li>
                      ))}
                      {!(emailDeliveriesData as { items?: unknown[] })?.items
                        ?.length && (
                        <p className="text-sm text-slate-500">No deliveries yet.</p>
                      )}
                    </ul>
                  )}
                </div>
              )}
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
              {saveError && (
                <span className="text-sm text-red-600 font-medium">
                  {saveError}
                </span>
              )}
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
