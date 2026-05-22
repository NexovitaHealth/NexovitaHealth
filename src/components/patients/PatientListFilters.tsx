"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type PatientListFiltersProps = {
  className?: string;
  selectClassName?: string;
};

export function PatientListFilters({
  className = "",
  selectClassName = "input-base w-full sm:w-36 text-sm",
}: PatientListFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const statusFilter = searchParams.get("status") ?? "";
  const riskFilter = searchParams.get("riskLevel") ?? "";

  const updateParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      const q = next.toString();
      router.replace(q ? `/patients?${q}` : "/patients", { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className={className}>
      <select
        value={statusFilter}
        onChange={(e) => updateParam("status", e.target.value)}
        className={selectClassName}
        aria-label="Filter by status"
      >
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="intake">Intake</option>
        <option value="discharged">Discharged</option>
        <option value="on_hold">On Hold</option>
      </select>
      <select
        value={riskFilter}
        onChange={(e) => updateParam("riskLevel", e.target.value)}
        className={selectClassName}
        aria-label="Filter by risk"
      >
        <option value="">All Risk</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </div>
  );
}
