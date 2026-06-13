"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Users,
  CheckSquare,
  MessageSquare,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { UniversalSearchResults } from "@/lib/universal-search";
import { formatRelative } from "@/lib/utils";

const MIN_LENGTH = 2;
const DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

type UniversalSearchProps = {
  previewLimit?: number;
  className?: string;
};

export function UniversalSearch({
  previewLimit = 5,
  className = "relative w-80",
}: UniversalSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { request, orgId } = useApi();
  const isPatientsPage = pathname === "/patients";
  const urlSearch = isPatientsPage ? (searchParams.get("search") ?? "") : "";

  const [query, setQuery] = useState(urlSearch);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

  useEffect(() => {
    if (isPatientsPage) setQuery(urlSearch);
  }, [isPatientsPage, urlSearch]);

  useEffect(() => {
    if (!isPatientsPage) return;
    const trimmed = debouncedQuery.trim();
    const current = searchParams.get("search") ?? "";
    if (trimmed === current) return;

    const next = new URLSearchParams(searchParams.toString());
    if (trimmed) next.set("search", trimmed);
    else next.delete("search");
    next.delete("page");
    const q = next.toString();
    router.replace(q ? `/patients?${q}` : "/patients", { scroll: false });
  }, [debouncedQuery, isPatientsPage, router, searchParams]);

  const canFetch =
    !!orgId && debouncedQuery.trim().length >= MIN_LENGTH && open;

  const { data, isFetching } = useQuery({
    queryKey: ["universal-search", orgId, debouncedQuery, previewLimit],
    queryFn: () =>
      request<UniversalSearchResults>(
        `/api/orgs/{orgId}/search?q=${encodeURIComponent(debouncedQuery.trim())}&limit=${previewLimit}`,
      ),
    enabled: canFetch,
    staleTime: 30_000,
  });

  const results = data?.data;
  const hasResults =
    !!results &&
    (results.patients.length > 0 ||
      results.tasks.length > 0 ||
      results.messages.length > 0);
  const totalHits = results
    ? results.totals.patients + results.totals.tasks + results.totals.messages
    : 0;

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const goToSearchPage = (q: string) => {
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < MIN_LENGTH) return;
    setOpen(false);
    if (isPatientsPage) {
      const next = new URLSearchParams(searchParams.toString());
      next.set("search", q);
      next.delete("page");
      const params = next.toString();
      router.replace(params ? `/patients?${params}` : "/patients", {
        scroll: false,
      });
      return;
    }
    goToSearchPage(q);
  };

  const showPanel =
    open && debouncedQuery.trim().length >= MIN_LENGTH;

  return (
    <div ref={containerRef} className={className}>
      <form onSubmit={handleSubmit}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <div
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="universal-search-results"
          aria-haspopup="listbox"
        >
          <input
            type="text"
            placeholder={
              isPatientsPage
                ? "Search by name, diagnosis…"
                : "Search patients, tasks, messages…"
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#028090]/20 focus:border-[#028090] focus:bg-white transition-all"
            autoComplete="off"
          />
        </div>
      </form>

      {showPanel && (
        <div
          id="universal-search-results"
          className="absolute left-0 right-0 top-full mt-2 z-50 bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden"
        >
          {isFetching && !results ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching…
            </div>
          ) : hasResults ? (
            <div className="max-h-[min(24rem,70vh)] overflow-y-auto">
              {results!.permissions.patients && results!.patients.length > 0 && (
                <SearchSection
                  icon={<Users className="w-3.5 h-3.5" />}
                  title="Patients"
                  total={results!.totals.patients}
                >
                  {results!.patients.map((hit) => (
                    <SearchRow
                      key={hit.id}
                      href={`/patients/${hit.id}`}
                      title={hit.fullName}
                      subtitle={
                        [hit.primaryDiagnosis, hit.city]
                          .filter(Boolean)
                          .join(" · ") || hit.status
                      }
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </SearchSection>
              )}

              {results!.permissions.tasks && results!.tasks.length > 0 && (
                <SearchSection
                  icon={<CheckSquare className="w-3.5 h-3.5" />}
                  title="Tasks"
                  total={results!.totals.tasks}
                >
                  {results!.tasks.map((hit) => (
                    <SearchRow
                      key={hit.id}
                      href={`/tasks?search=${encodeURIComponent(hit.title)}`}
                      title={hit.title}
                      subtitle={
                        hit.patientName
                          ? `${hit.status} · ${hit.patientName}`
                          : hit.status
                      }
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </SearchSection>
              )}

              {results!.permissions.messages && results!.messages.length > 0 && (
                <SearchSection
                  icon={<MessageSquare className="w-3.5 h-3.5" />}
                  title="Messages"
                  total={results!.totals.messages}
                >
                  {results!.messages.map((hit) => (
                    <SearchRow
                      key={hit.threadId}
                      href={`/messages?threadId=${hit.threadId}`}
                      title={
                        hit.subject ||
                        hit.patientName ||
                        "Conversation"
                      }
                      subtitle={hit.snippet}
                      meta={formatRelative(hit.updatedAt)}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </SearchSection>
              )}

              {totalHits > previewLimit && (
                <button
                  type="button"
                  onClick={() => goToSearchPage(debouncedQuery.trim())}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#028090] hover:bg-slate-50 border-t border-slate-100"
                >
                  View all results
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="px-4 py-6 text-sm text-slate-500 text-center">
              No results for &ldquo;{debouncedQuery.trim()}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchSection({
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
    <div className="border-b border-slate-50 last:border-b-0">
      <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-50/80">
        {icon}
        {title}
        {total > 0 && <span className="ml-auto tabular-nums">{total}</span>}
      </div>
      {children}
    </div>
  );
}

function SearchRow({
  href,
  title,
  subtitle,
  meta,
  onNavigate,
}: {
  href: string;
  title: string;
  subtitle?: string;
  meta?: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="block px-3 py-2.5 hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-800 truncate">{title}</p>
        {meta && (
          <span className="text-[10px] text-slate-400 shrink-0">{meta}</span>
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>
      )}
    </Link>
  );
}
