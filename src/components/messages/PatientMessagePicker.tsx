"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { Search, X, User } from "lucide-react";

type PatientOption = { id: string; fullName: string };

interface Props {
  value: PatientOption | null;
  onChange: (patient: PatientOption | null) => void;
  disabled?: boolean;
}

export function PatientMessagePicker({ value, onChange, disabled }: Props) {
  const { request, orgId } = useApi();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["message-patient-picker", orgId, query],
    queryFn: () =>
      request<PatientOption[]>(
        `/api/orgs/{orgId}/patients?page=1&pageSize=15&search=${encodeURIComponent(query)}`,
      ),
    enabled: !!orgId && open,
  });

  const patients = (data?.data ?? []) as PatientOption[];

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-teal-200 bg-teal-50">
        <User className="w-4 h-4 text-[#028090]" />
        <span className="text-sm font-medium text-teal-900 flex-1">
          {value.fullName}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-1 rounded-lg hover:bg-teal-100 text-teal-700"
            aria-label="Clear patient"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          type="text"
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Link to patient (search by name)..."
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] bg-white disabled:opacity-50"
        />
      </div>
      {open && (
        <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg py-1">
          {isLoading ? (
            <li className="px-3 py-2 text-xs text-slate-400">Searching…</li>
          ) : patients.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-400">
              {query ? "No patients found" : "Type to search patients"}
            </li>
          ) : (
            patients.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-800"
                  onClick={() => {
                    onChange(p);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  {p.fullName}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
