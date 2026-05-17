"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import {
  FolderKanban,
  Plus,
  ClipboardList,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";

export default function ProjectsPage() {
  const { request, orgId } = useApi();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data: projectsResponse, isLoading } = useQuery({
    queryKey: ["projects", orgId],
    queryFn: () => request(`/api/orgs/${orgId}/projects`),
    enabled: !!orgId,
  });

  type Project = {
    id: string;
    name: string;
    description?: string;
    status?: string;
    columns?: Array<{ id: string; name: string; _count?: { tasks: number } }>;
    _count?: { tasks: number };
  };
  const projects = (projectsResponse?.data ?? []) as Project[];

  const createProject = useMutation({
    mutationFn: (data: any) =>
      request(`/api/orgs/${orgId}/projects`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", orgId] });
      setShowNew(false);
      setForm({ name: "", description: "" });
    },
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">
            {projects.length} active projects
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {showNew && (
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Create Project</h3>
          <div className="space-y-3">
            <input
              placeholder="Project name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input-base"
            />
            <textarea
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="input-base resize-none h-20"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowNew(false)}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => createProject.mutate(form)}
                disabled={!form.name || createProject.isPending}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {createProject.isPending ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-full mb-4" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {projects.map((p: any) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="card p-5 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: p.color + "20" }}
              >
                <FolderKanban className="w-5 h-5" style={{ color: p.color }} />
              </div>
              <span
                className={`badge text-xs ${
                  p.status === "active"
                    ? "bg-emerald-50 text-emerald-700"
                    : p.status === "completed"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {p.status}
              </span>
            </div>
            <h3 className="font-semibold text-slate-800 group-hover:text-[#028090] transition-colors">
              {p.name}
            </h3>
            {p.description && (
              <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                {p.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>{p._count?.tasks || 0} tasks</span>
              <span className="ml-auto text-[10px]">
                {p.columns?.length || 0} columns
              </span>
            </div>
          </Link>
        ))}
      </div>

      {!isLoading && projects.length === 0 && (
        <div className="card p-12 text-center">
          <FolderKanban className="w-12 h-12 mx-auto text-slate-200 mb-4" />
          <h3 className="font-semibold text-slate-700">No projects yet</h3>
          <p className="text-slate-400 text-sm mt-1">
            Create your first project to organize tasks as a kanban board
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="btn-primary mt-4 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Project
          </button>
        </div>
      )}
    </div>
  );
}
