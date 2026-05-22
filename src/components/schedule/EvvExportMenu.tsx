"use client";

import { useState } from "react";
import { Download, ChevronDown } from "lucide-react";

interface Props {
  orgId: string;
  startDate: string;
  endDate: string;
}

export function EvvExportMenu({ orgId, startDate, endDate }: Props) {
  const [open, setOpen] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(true);

  const base = `/api/orgs/${orgId}/visits/evv-export?startDate=${startDate}&endDate=${endDate}&verifiedOnly=${verifiedOnly}`;

  const download = (format: "standard" | "medicaid") => {
    window.location.href = `${base}&format=${format}`;
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-slate-50"
      >
        <Download className="w-4 h-4" />
        EVV export
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-20 w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-4 space-y-3">
            <p className="text-xs text-slate-500">
              Export visits with check-in for {startDate} – {endDate}
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="rounded border-slate-300 text-[#028090]"
              />
              EVV-verified only
            </label>
            <button
              type="button"
              onClick={() => download("standard")}
              className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-50 border border-slate-100"
            >
              <span className="font-medium text-slate-900">Standard CSV</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Internal Nexovita field layout
              </span>
            </button>
            <button
              type="button"
              onClick={() => download("medicaid")}
              className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-50 border border-teal-100 bg-teal-50/50"
            >
              <span className="font-medium text-teal-900">Medicaid EVV file</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Sandata-aligned columns for state aggregators
              </span>
            </button>
            <p className="text-[10px] text-slate-400">
              Configure provider IDs in Settings → Organization → Medicaid EVV.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
