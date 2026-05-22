"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/utils";
import { FileSignature, Loader2 } from "lucide-react";

type PhysicianOrder = {
  id: string;
  title: string;
  orderType: string;
  status: string;
  createdAt: string;
  signedAt?: string | null;
  patient: { id: string; fullName: string };
  physician: { fullName: string };
};

const CLINICAL = [
  "agency_admin",
  "supervisor",
  "physician",
  "physician_independent",
];

export default function PhysicianOrdersPage() {
  const { request, orgId } = useApi();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState("");

  const canView = CLINICAL.includes(user?.role || "");

  const { data, isLoading } = useQuery({
    queryKey: ["physician-orders", orgId, statusFilter],
    queryFn: () => {
      const q = statusFilter ? `?status=${statusFilter}&pageSize=100` : "?pageSize=100";
      return request<PhysicianOrder[]>(`/api/orgs/{orgId}/physician-orders${q}`);
    },
    enabled: !!orgId && canView,
  });

  const orders = (data?.data as PhysicianOrder[]) || [];

  if (!canView) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Physician orders are limited to clinical staff.
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mb-6">
        <FileSignature className="w-6 h-6 text-[#028090]" />
        Physician orders
      </h1>

      <div className="flex flex-wrap gap-2 mb-4">
        {["", "draft", "active", "discontinued"].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
              statusFilter === s
                ? "bg-[#028090] text-white"
                : "bg-white border text-slate-600"
            }`}
          >
            {s || "all"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loader2 className="w-8 h-8 animate-spin text-[#028090] mx-auto" />
      ) : orders.length === 0 ? (
        <p className="text-sm text-slate-500">No physician orders found.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => (
            <li
              key={order.id}
              className="bg-white border rounded-xl p-4 flex flex-wrap justify-between gap-2"
            >
              <div>
                <p className="font-semibold text-slate-900">{order.title}</p>
                <p className="text-sm text-slate-600">
                  <Link
                    href={`/patients/${order.patient.id}`}
                    className="text-[#028090] hover:underline"
                  >
                    {order.patient.fullName}
                  </Link>
                  {" · "}
                  {order.orderType} · {order.physician.fullName}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {formatDateTime(order.createdAt)} ·{" "}
                  <span className="capitalize">{order.status}</span>
                </p>
              </div>
              <Link
                href={`/patients/${order.patient.id}`}
                className="text-sm text-[#028090] font-medium self-center"
              >
                Open chart
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
