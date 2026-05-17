"use client";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { ChevronLeft, Plus, MoreHorizontal } from "lucide-react";
import { priorityColor, formatRelative } from "@/lib/utils";
import Link from "next/link";

const PRIORITY_ICONS: Record<string, string> = {
  urgent: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "⚪",
};

export default function ProjectKanbanPage() {
  const { projectId } = useParams();
  const { request, orgId } = useApi();
  const queryClient = useQueryClient();
  const [newTaskColumn, setNewTaskColumn] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);

  const { data: project } = useQuery({
    queryKey: ["project", orgId, projectId],
    queryFn: () =>
      request(`/api/orgs/${orgId}/projects`).then((res) =>
        (res.data as any[])?.find((p: any) => p.id === projectId),
      ),
    enabled: !!orgId && !!projectId,
  });

  const { data: tasksData } = useQuery({
    queryKey: ["tasks", orgId, "project", projectId],
    queryFn: () =>
      request<any>(
        `/api/orgs/${orgId}/tasks?projectId=${projectId}&pageSize=200`,
      ),
    enabled: !!orgId && !!projectId,
  });

  const updateTask = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: any }) =>
      request(`/api/orgs/${orgId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["tasks", orgId, "project", projectId],
      }),
  });

  const createTask = useMutation({
    mutationFn: (data: any) =>
      request(`/api/orgs/${orgId}/tasks`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tasks", orgId, "project", projectId],
      });
      setNewTaskColumn(null);
      setNewTaskTitle("");
    },
  });

  const tasks = (tasksData?.data as unknown[]) || [];
  const columns = project?.columns || [];

  const tasksByColumn = (columnId: string) =>
    tasks.filter((t: any) => t.columnId === columnId);

  const handleDrop = (columnId: string, taskId: string) => {
    updateTask.mutate({ taskId, data: { columnId } });
    setDragging(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 bg-white border-b border-slate-100">
        <Link
          href="/projects"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3"
        >
          <ChevronLeft className="w-4 h-4" /> Projects
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {project?.name || "Loading..."}
            </h1>
            {project?.description && (
              <p className="text-sm text-slate-500 mt-0.5">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="badge bg-slate-100 text-slate-600">
              {tasks.length} tasks
            </span>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div
          className="flex gap-4 h-full"
          style={{ minWidth: `${columns.length * 280}px` }}
        >
          {columns.map((col: any) => {
            const colTasks = tasksByColumn(col.id);
            return (
              <div
                key={col.id}
                className="flex flex-col w-72 flex-shrink-0"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging) handleDrop(col.id, dragging);
                }}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-3 py-2.5 mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: col.color }}
                    />
                    <h3 className="text-sm font-semibold text-slate-700">
                      {col.name}
                    </h3>
                    <span className="bg-slate-100 text-slate-500 text-xs px-1.5 py-0.5 rounded-full font-medium">
                      {colTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setNewTaskColumn(col.id)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Column Tasks */}
                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {/* New task form */}
                  {newTaskColumn === col.id && (
                    <div className="card p-3 border-[#028090]/30">
                      <textarea
                        autoFocus
                        placeholder="Task title..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        className="w-full text-sm text-slate-700 resize-none outline-none placeholder-slate-300 min-h-[60px]"
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            newTaskTitle.trim()
                          ) {
                            e.preventDefault();
                            createTask.mutate({
                              title: newTaskTitle.trim(),
                              projectId,
                              columnId: col.id,
                            });
                          }
                          if (e.key === "Escape") {
                            setNewTaskColumn(null);
                            setNewTaskTitle("");
                          }
                        }}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() =>
                            newTaskTitle.trim() &&
                            createTask.mutate({
                              title: newTaskTitle.trim(),
                              projectId,
                              columnId: col.id,
                            })
                          }
                          disabled={
                            !newTaskTitle.trim() || createTask.isPending
                          }
                          className="px-3 py-1.5 bg-[#028090] text-white text-xs rounded-lg hover:bg-[#016070] transition-colors disabled:opacity-50"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setNewTaskColumn(null);
                            setNewTaskTitle("");
                          }}
                          className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {colTasks.map((task: any) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => setDragging(null)}
                      className={`card p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                        dragging === task.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800 leading-snug">
                          {task.title}
                        </p>
                        <button className="p-0.5 rounded hover:bg-slate-100 flex-shrink-0">
                          <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>

                      {task.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-3">
                        <span
                          className={`badge text-[10px] ${priorityColor(task.priority)}`}
                        >
                          {PRIORITY_ICONS[task.priority]} {task.priority}
                        </span>
                        <div className="flex items-center gap-1">
                          {task.assignees?.slice(0, 3).map((a: any) => (
                            <div
                              key={a.userId}
                              className="w-5 h-5 rounded-full bg-[#028090]/10 flex items-center justify-center border border-white"
                            >
                              <span className="text-[8px] text-[#028090] font-bold">
                                {a.user?.fullName?.charAt(0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {task.dueDate && (
                        <p className="text-[10px] text-slate-400 mt-2">
                          Due {formatRelative(task.dueDate)}
                        </p>
                      )}
                    </div>
                  ))}

                  {colTasks.length === 0 && newTaskColumn !== col.id && (
                    <div className="border-2 border-dashed border-slate-100 rounded-xl p-4 text-center">
                      <p className="text-xs text-slate-300">
                        Drop tasks here or
                      </p>
                      <button
                        onClick={() => setNewTaskColumn(col.id)}
                        className="text-xs text-[#028090] hover:underline mt-0.5"
                      >
                        add a task
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
