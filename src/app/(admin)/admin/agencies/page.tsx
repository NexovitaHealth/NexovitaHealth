"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Building2, Plus, Search, ChevronRight,
  Users, MapPin, CheckCircle2, XCircle, Loader2,
} from "lucide-react";

type Agency = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { members: number; branches: number; patients: number };
};

const emptyForm = { name: "", slug: "", email: "", phone: "", city: "", region: "", country: "us", subscriptionTier: "agency" };

async function fetchAgencies(): Promise<Agency[]> {
  const res = await fetch("/api/admin/agencies");
  if (!res.ok) throw new Error("Failed to load agencies");
  const { data } = await res.json();
  return data;
}

async function createAgency(body: typeof emptyForm) {
  const res = await fetch("/api/admin/agencies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to create agency");
  return json.data;
}

export default function AgenciesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: agencies = [], isLoading } = useQuery({
    queryKey: ["admin", "agencies"],
    queryFn: fetchAgencies,
  });

  const mutation = useMutation({
    mutationFn: createAgency,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "agencies"] });
      setCreating(false);
      setForm(emptyForm);
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const filtered = agencies.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.slug.toLowerCase().includes(search.toLowerCase()) ||
      (a.city || "").toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) {
      setFormError("Name and slug are required.");
      return;
    }
    setFormError(null);
    mutation.mutate(form);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Agencies</h1>
          <p className="text-sm text-slate-500 mt-0.5">{agencies.length} total</p>
        </div>
        <button
          onClick={() => { setCreating(true); setFormError(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#028090] text-white text-sm font-medium hover:bg-[#026e7d] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Agency
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#028090]/30"
          placeholder="Search agencies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Agency List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No agencies yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {filtered.map((a) => (
            <Link
              key={a.id}
              href={`/admin/agencies/${a.id}`}
              className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-[#028090]/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-[#028090]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800 text-sm truncate">{a.name}</p>
                  {a.isActive ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {[a.city, a.region].filter(Boolean).join(", ") || "No location"} · /{a.slug}
                </p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {a._count.members}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {a._count.branches}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {creating && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">New Agency</h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {formError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Agency Name *</label>
                <input
                  className="input w-full"
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({
                      ...f,
                      name,
                      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
                    }));
                  }}
                  placeholder="Sunrise Health Agency"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Slug *</label>
                <input
                  className="input w-full font-mono text-sm"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
                  placeholder="sunrise-health"
                />
                <p className="text-xs text-slate-400 mt-1">Lowercase letters, numbers, and hyphens only.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                  <input className="input w-full" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="admin@agency.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                  <input className="input w-full" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1-555-0100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                  <input className="input w-full" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Los Angeles" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">State / Region</label>
                  <input className="input w-full" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} placeholder="CA" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setCreating(false); setFormError(null); setForm(emptyForm); }}
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="flex-1 px-4 py-2 rounded-xl bg-[#028090] text-white text-sm font-medium hover:bg-[#026e7d] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Agency
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
