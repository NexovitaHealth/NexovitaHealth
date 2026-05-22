"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Users,
  CheckSquare,
  MessageSquare,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { UniversalSearchResults } from "@/lib/universal-search";
import { formatRelative } from "@/lib/utils";

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const { request, orgId } = useApi();
  const [query, setQuery] = useState(initialQ);

  useEffect(() => {
    setQuery(initialQ);
  }, [initialQ]);

  const trimmed = query.trim();
  const canSearch = !!orgId && trimmed.length >= 2;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["universal-search-page", orgId, trimmed],
    queryFn: () =>
      request<UniversalSearchResults>(
        `/api/orgs/{orgId}/search?q=${encodeURIComponent(trimmed)}&limit=25`,
      ),
    enabled: canSearch,
  });

  const results = data?.data;
  const totalHits = results
    ? results.totals.patients + results.totals.tasks + results.totals.messages
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length >= 2) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Search</h1>
        <p className="text-sm text-slate-500 mt-1">
          Find patients, tasks, and message threads across your organization.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search patients, tasks, messages…"
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#028090]/20 focus:border-[#028090]"
          autoFocus
        />
      </form>

      {trimmed.length > 0 && trimmed.length < 2 && (
        <p className="text-sm text-slate-500">
          Enter at least 2 characters to search.
        </p>
      )}

      {canSearch && (isLoading || isFetching) && !results && (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Searching…
        </div>
      )}

      {canSearch && results && totalHits === 0 && (
        <p className="text-sm text-slate-500 py-8 text-center">
          No results for &ldquo;{trimmed}&rdquo;
        </p>
      )}

      {canSearch && results && totalHits > 0 && (
        <p className="text-xs text-slate-400">
          {totalHits} result{totalHits === 1 ? "" : "s"} for &ldquo;{trimmed}
          &rdquo;
        </p>
      )}

      {results?.permissions.patients && results.patients.length > 0 && (
        <ResultSection
          icon={<Users className="w-4 h-4" />}
          title="Patients"
          total={results.totals.patients}
        >
          {results.patients.map((hit) => (
            <ResultRow
              key={hit.id}
              href={`/patients/${hit.id}`}
              title={hit.fullName}
              subtitle={
                [hit.primaryDiagnosis, hit.city, hit.status]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
            />
          ))}
        </ResultSection>
      )}

      {results?.permissions.tasks && results.tasks.length > 0 && (
        <ResultSection
          icon={<CheckSquare className="w-4 h-4" />}
          title="Tasks"
          total={results.totals.tasks}
        >
          {results.tasks.map((hit) => (
            <ResultRow
              key={hit.id}
              href={`/tasks?search=${encodeURIComponent(hit.title)}`}
              title={hit.title}
              subtitle={
                hit.patientName
                  ? `${hit.status} · ${hit.priority} · ${hit.patientName}`
                  : `${hit.status} · ${hit.priority}`
              }
            />
          ))}
        </ResultSection>
      )}

      {results?.permissions.messages && results.messages.length > 0 && (
        <ResultSection
          icon={<MessageSquare className="w-4 h-4" />}
          title="Messages"
          total={results.totals.messages}
        >
          {results.messages.map((hit) => (
            <ResultRow
              key={hit.threadId}
              href={`/messages?threadId=${hit.threadId}`}
              title={hit.subject || hit.patientName || "Conversation"}
              subtitle={hit.snippet}
              meta={formatRelative(hit.updatedAt)}
            />
          ))}
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({
  icon,
  title,
  total,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-100 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <span className="text-[#028090]">{icon}</span>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          {total}
        </span>
      </div>
      <div className="divide-y divide-slate-50">{children}</div>
    </section>
  );
}

function ResultRow({
  href,
  title,
  subtitle,
  meta,
}: {
  href: string;
  title: string;
  subtitle?: string;
  meta?: string;
}) {
  return (
    <Link
      href={href}
      className="block px-4 py-3 hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        {meta && <span className="text-xs text-slate-400 shrink-0">{meta}</span>}
      </div>
      {subtitle && (
        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{subtitle}</p>
      )}
    </Link>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
