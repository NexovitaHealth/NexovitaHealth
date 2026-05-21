"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { formatRelative, priorityColor } from "@/lib/utils";
import {
  Plus,
  Search,
  Filter,
  CheckSquare,
  Clock,
  AlertTriangle,
  Circle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  X,
} from "lucide-react";

const STATUS_OPTIONS = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];
const PRIORITY_OPTIONS = ["urgent", "high", "medium", "low"];
const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle className="w-3.5 h-3.5 text-slate-400" />,
  in_progress: <Clock className="w-3.5 h-3.5 text-blue-500" />,
  completed: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  cancelled: <X className="w-3.5 h-3.5 text-slate-400" />,
};

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: "Pending",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  const colors: Record<string, string> = {
    pending: "bg-slate-100 text-slate-600",
    in_progress: "bg-blue-50 text-blue-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-slate-50 text-slate-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${colors[status] || "bg-slate-100 text-slate-600"}`}
    >
      {STATUS_ICONS[status]}
      {labels[status] || status}
    </span>
  );
}

export default function TasksPage() {
  const { request, orgId } = useApi();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (statusFilter) params.set("status", statusFilter);
  if (priorityFilter) params.set("priority", priorityFilter);
  params.set("limit", "50");

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", orgId, search, statusFilter, priorityFilter],
    queryFn: () => request(`/api/orgs/{orgId}/tasks?${params}`),
    enabled: !!orgId,
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects", orgId],
    queryFn: () => request("/api/orgs/{orgId}/projects"),
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const projects = (projectsData?.data ?? []) as Array<{
        id: string;
        name: string;
        columns?: Array<{ id: string; name: string }>;
      }>;
      const projectId = projects[0]?.id;
      if (!projectId)
        throw new Error("No projects found. Create a project first.");
      const firstCol = projects[0]?.columns?.[0]?.id;
      return request("/api/orgs/{orgId}/tasks", {
        method: "POST",
        body: JSON.stringify({ ...newTask, projectId, columnId: firstCol }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setShowCreate(false);
      setNewTask({
        title: "",
        description: "",
        priority: "medium",
        dueDate: "",
      });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      request(`/api/orgs/{orgId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const tasks = (data?.data ?? []) as Array<{
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    dueDate?: string;
    updatedAt: string;
    project?: { name: string };
    column?: { title: string };
    assignees?: Array<{ user: { fullName: string } }>;
  }>;
  const counts = {
    all: tasks.length,
    pending: tasks.filter((t: { status: string }) => t.status === "pending").length,
    in_progress: tasks.filter(
      (t: { status: string }) => t.status === "in_progress",
    ).length,
    completed: tasks.filter((t: { status: string }) => t.status === "completed").length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-[#028090]" />
            Tasks
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage and track care team tasks
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#028090] hover:bg-[#026f7c] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "All Tasks",
            value: counts.all,
            icon: <CheckSquare className="w-4 h-4" />,
            color: "text-slate-600",
          },
          {
            label: "Pending",
            value: counts.pending,
            icon: <Circle className="w-4 h-4" />,
            color: "text-slate-500",
          },
          {
            label: "In Progress",
            value: counts.in_progress,
            icon: <Clock className="w-4 h-4" />,
            color: "text-blue-500",
          },
          {
            label: "Completed",
            value: counts.completed,
            icon: <CheckCircle2 className="w-4 h-4" />,
            color: "text-emerald-500",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3"
          >
            <div className={`${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
            placeholder="Search tasks..."
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] bg-white"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] bg-white"
          >
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Task list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-medium">No tasks found</p>
            <p className="text-sm mt-1">
              Create your first task to get started
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                  Task
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                  Priority
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                  Project
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                  Due
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map(
                (task: {
                  id: string;
                  title: string;
                  description?: string;
                  status: string;
                  priority: string;
                  dueDate?: string;
                  updatedAt: string;
                  project?: { name: string };
                  column?: { title: string };
                  assignees?: Array<{ user: { fullName: string } }>;
                }) => (
                  <tr
                    key={task.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() =>
                            updateStatus.mutate({
                              taskId: task.id,
                              status:
                                task.status === "completed"
                                  ? "pending"
                                  : task.status === "pending"
                                    ? "in_progress"
                                    : "completed",
                            })
                          }
                          className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {STATUS_ICONS[task.status]}
                        </button>
                        <div className="mt-0.5 group-hover:hidden">
                          {STATUS_ICONS[task.status]}
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium ${task.status === "completed" ? "line-through text-slate-400" : "text-slate-900"}`}
                          >
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${priorityColor(task.priority)}`}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {task.project?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {task.dueDate
                        ? new Date(task.dueDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {formatRelative(task.updatedAt)}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">New Task</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {createMutation.error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {(createMutation.error as Error).message}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Title
                </label>
                <input
                  value={newTask.title}
                  onChange={(e) =>
                    setNewTask((p) => ({ ...p, title: e.target.value }))
                  }
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                  placeholder="Task title"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Description
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask((p) => ({ ...p, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] resize-none"
                  placeholder="Optional description..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Priority
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) =>
                      setNewTask((p) => ({ ...p, priority: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] bg-white"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) =>
                      setNewTask((p) => ({ ...p, dueDate: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!newTask.title || createMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-[#028090] hover:bg-[#026f7c] disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                  </>
                ) : (
                  "Create Task"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
