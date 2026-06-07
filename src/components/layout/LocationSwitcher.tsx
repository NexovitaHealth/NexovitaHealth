"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, ChevronDown, Check, Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOrgApi } from "@/hooks/useOrgApi";
import { usePermissions } from "@/hooks/usePermissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Branch = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  phone?: string | null;
};

type FormState = { name: string; city: string; region: string; phone: string; address: string };

const emptyForm: FormState = { name: "", city: "", region: "", phone: "", address: "" };

function branchToForm(b: Branch): FormState {
  return {
    name: b.name,
    city: b.city ?? "",
    region: b.region ?? "",
    phone: b.phone ?? "",
    address: b.address ?? "",
  };
}

export function LocationSwitcher() {
  const { activeBranchId, setActiveBranch } = useAuth();
  const { client, orgId } = useOrgApi();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const canManage = can("org:update_settings");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const pickerRef = useRef<HTMLDivElement>(null);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["branches", orgId],
    queryFn: () => client!.branches.list(),
    enabled: !!client,
  });

  const activeBranch = branches.find((b) => b.id === activeBranchId) ?? null;

  // Validate stored branch is still active
  useEffect(() => {
    if (activeBranchId && branches.length > 0 && !activeBranch) {
      setActiveBranch(null);
    }
  }, [activeBranchId, activeBranch, branches.length, setActiveBranch]);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [pickerOpen]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["branches", orgId] });

  const createMutation = useMutation({
    mutationFn: (data: FormState) => client!.branches.create(data),
    onSuccess: (newBranch) => {
      invalidate();
      setAddingNew(false);
      setForm(emptyForm);
      setManageOpen(false);
      if (newBranch?.id) setActiveBranch(newBranch.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormState }) =>
      client!.branches.update(id, data),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => client!.branches.deactivate(id),
    onSuccess: (_, id) => {
      if (activeBranchId === id) setActiveBranch(null);
      invalidate();
      setDeleteConfirmId(null);
    },
  });

  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <>
      {/* Picker trigger */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setPickerOpen((o) => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm text-slate-700 transition-colors max-w-[160px]"
        >
          <MapPin className="w-3.5 h-3.5 text-[#028090] flex-shrink-0" />
          <span className="truncate font-medium">
            {activeBranch ? activeBranch.name : "All Locations"}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
        </button>

        {pickerOpen && (
          <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1.5 overflow-hidden">
            <button
              onClick={() => {
                setActiveBranch(null);
                setPickerOpen(false);
              }}
              className="w-full flex items-center justify-between px-3.5 py-2 text-sm hover:bg-slate-50 transition-colors"
            >
              <span className="font-medium text-slate-700">All Locations</span>
              {!activeBranchId && <Check className="w-3.5 h-3.5 text-[#028090]" />}
            </button>

            {branches.length > 0 && (
              <div className="border-t border-slate-100 mt-1 pt-1">
                {branches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setActiveBranch(b.id);
                      setPickerOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-sm hover:bg-slate-50 transition-colors"
                  >
                    <div className="text-left min-w-0">
                      <span className="block font-medium text-slate-700 truncate">{b.name}</span>
                      {b.city && (
                        <span className="block text-xs text-slate-400 truncate">{b.city}</span>
                      )}
                    </div>
                    {activeBranchId === b.id && (
                      <Check className="w-3.5 h-3.5 text-[#028090] flex-shrink-0 ml-2" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {canManage && (
              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  onClick={() => {
                    setPickerOpen(false);
                    setManageOpen(true);
                    setAddingNew(false);
                    setEditingId(null);
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-[#028090] hover:bg-slate-50 transition-colors font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Manage Locations
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manage modal */}
      {manageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => {
              if (!isMutating) {
                setManageOpen(false);
                setAddingNew(false);
                setEditingId(null);
                setDeleteConfirmId(null);
              }
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Manage Locations</h2>
              <button
                onClick={() => {
                  setManageOpen(false);
                  setAddingNew(false);
                  setEditingId(null);
                  setDeleteConfirmId(null);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                disabled={isMutating}
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
              {branches.map((b) => (
                <div key={b.id}>
                  {editingId === b.id ? (
                    <BranchForm
                      value={form}
                      onChange={setForm}
                      isPending={updateMutation.isPending}
                      onCancel={() => setEditingId(null)}
                      onSubmit={() => updateMutation.mutate({ id: b.id, data: form })}
                      submitLabel="Save"
                    />
                  ) : deleteConfirmId === b.id ? (
                    <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-sm">
                      <p className="text-red-800 font-medium mb-2">
                        Remove &ldquo;{b.name}&rdquo;?
                      </p>
                      <p className="text-red-600 text-xs mb-3">
                        Patients assigned to this location will no longer be associated with it.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="flex-1 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(b.id)}
                          disabled={deleteMutation.isPending}
                          className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                        >
                          {deleteMutation.isPending && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          )}
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors group">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{b.name}</p>
                        {(b.city || b.region) && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {[b.city, b.region].filter(Boolean).join(", ")}
                          </p>
                        )}
                        {b.phone && (
                          <p className="text-xs text-slate-400">{b.phone}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingId(b.id);
                            setForm(branchToForm(b));
                            setAddingNew(false);
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(b.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {branches.length === 0 && !addingNew && (
                <p className="text-sm text-slate-400 text-center py-4">
                  No locations yet. Add your first one below.
                </p>
              )}

              {addingNew ? (
                <BranchForm
                  value={form}
                  onChange={setForm}
                  isPending={createMutation.isPending}
                  onCancel={() => {
                    setAddingNew(false);
                    setForm(emptyForm);
                  }}
                  onSubmit={() => createMutation.mutate(form)}
                  submitLabel="Add Location"
                />
              ) : (
                <button
                  onClick={() => {
                    setAddingNew(true);
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 hover:border-[#028090] hover:text-[#028090] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Location
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BranchForm({
  value,
  onChange,
  isPending,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  value: FormState;
  onChange: (v: FormState) => void;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  const field = (key: keyof FormState) => ({
    value: value[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [key]: e.target.value }),
  });

  return (
    <div className="p-3 rounded-xl border border-[#028090]/30 bg-[#028090]/5 space-y-2">
      <input
        className="input-base w-full text-sm py-2"
        placeholder="Location name *"
        required
        {...field("name")}
      />
      <input
        className="input-base w-full text-sm py-2"
        placeholder="Address"
        {...field("address")}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className="input-base w-full text-sm py-2"
          placeholder="City"
          {...field("city")}
        />
        <input
          className="input-base w-full text-sm py-2"
          placeholder="Region / State"
          {...field("region")}
        />
      </div>
      <input
        className="input-base w-full text-sm py-2"
        placeholder="Phone"
        {...field("phone")}
      />
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending || !value.name.trim()}
          className="flex-1 py-2 rounded-xl bg-[#028090] hover:bg-[#026f7c] disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
        >
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
