import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canUserPerform, type Permission } from "@/lib/permissions";
import { parseAssignedToMeFilter } from "@/lib/patient-list-scope";
import {
  getFieldStaffPatientIds,
  isFieldStaffRole,
} from "@/lib/message-scope";
import type { UserRole } from "@/types";

export const UNIVERSAL_SEARCH_MIN_LENGTH = 2;
export const UNIVERSAL_SEARCH_MAX_LIMIT = 25;
export const UNIVERSAL_SEARCH_PREVIEW_LIMIT = 5;

export type UniversalSearchPatientHit = {
  type: "patient";
  id: string;
  fullName: string;
  status: string;
  primaryDiagnosis: string | null;
  city: string | null;
};

export type UniversalSearchTaskHit = {
  type: "task";
  id: string;
  title: string;
  status: string;
  priority: string;
  patientName: string | null;
  dueDate: string | null;
};

export type UniversalSearchMessageHit = {
  type: "message";
  threadId: string;
  subject: string | null;
  patientName: string | null;
  snippet: string;
  updatedAt: string;
};

export type UniversalSearchResults = {
  query: string;
  patients: UniversalSearchPatientHit[];
  tasks: UniversalSearchTaskHit[];
  messages: UniversalSearchMessageHit[];
  totals: {
    patients: number;
    tasks: number;
    messages: number;
  };
  permissions: {
    patients: boolean;
    tasks: boolean;
    messages: boolean;
  };
};

export type UniversalSearchContext = {
  orgId: string;
  userId: string;
  userRole: UserRole | string;
  orgRole?: string | null;
  assignedToMe?: boolean;
};

function clampLimit(limit: unknown): number {
  const n = typeof limit === "number" ? limit : Number(limit);
  if (!Number.isFinite(n) || n < 1) return UNIVERSAL_SEARCH_PREVIEW_LIMIT;
  return Math.min(Math.floor(n), UNIVERSAL_SEARCH_MAX_LIMIT);
}

function normalizeQuery(raw: string): string | null {
  const q = raw.trim();
  if (q.length < UNIVERSAL_SEARCH_MIN_LENGTH) return null;
  return q;
}

function snippet(text: string, max = 120): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function canSearch(
  ctx: UniversalSearchContext,
  permission: Permission,
): boolean {
  return canUserPerform(ctx.userRole, ctx.orgRole ?? null, permission);
}

async function searchPatients(
  ctx: UniversalSearchContext,
  q: string,
  limit: number,
): Promise<{ hits: UniversalSearchPatientHit[]; total: number }> {
  const assignedToMe =
    ctx.assignedToMe ??
    parseAssignedToMeFilter(ctx.userRole, null);

  const where: Prisma.PatientWhereInput = {
    orgId: ctx.orgId,
    deletedAt: null,
    isDraft: false,
    ...(assignedToMe && {
      careTeam: {
        some: { userId: ctx.userId, isActive: true },
      },
    }),
    OR: [
      { fullName: { contains: q, mode: "insensitive" } },
      { primaryDiagnosis: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        fullName: true,
        status: true,
        primaryDiagnosis: true,
        city: true,
      },
    }),
    prisma.patient.count({ where }),
  ]);

  return {
    hits: rows.map((row) => ({
      type: "patient" as const,
      id: row.id,
      fullName: row.fullName,
      status: row.status,
      primaryDiagnosis: row.primaryDiagnosis,
      city: row.city,
    })),
    total,
  };
}

async function searchTasks(
  ctx: UniversalSearchContext,
  q: string,
  limit: number,
): Promise<{ hits: UniversalSearchTaskHit[]; total: number }> {
  const where: Prisma.TaskWhereInput = {
    orgId: ctx.orgId,
    deletedAt: null,
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.task.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        patient: { select: { fullName: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return {
    hits: rows.map((row) => ({
      type: "task" as const,
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      patientName: row.patient?.fullName ?? null,
      dueDate: row.dueDate?.toISOString() ?? null,
    })),
    total,
  };
}

async function searchMessages(
  ctx: UniversalSearchContext,
  q: string,
  limit: number,
): Promise<{ hits: UniversalSearchMessageHit[]; total: number }> {
  const accessiblePatients =
    canSearch(ctx, "patient:read") && isFieldStaffRole(ctx.userRole)
      ? new Set(await getFieldStaffPatientIds(ctx.userId, ctx.orgId))
      : null;

  const baseWhere: Prisma.MessageThreadWhereInput = {
    orgId: ctx.orgId,
    deletedAt: null,
    participants: { some: { userId: ctx.userId } },
    OR: [
      { subject: { contains: q, mode: "insensitive" } },
      {
        patient: {
          fullName: { contains: q, mode: "insensitive" },
        },
      },
      {
        messages: {
          some: {
            deletedAt: null,
            body: { contains: q, mode: "insensitive" },
          },
        },
      },
    ],
    ...(accessiblePatients
      ? { patientId: { in: Array.from(accessiblePatients) } }
      : {}),
  };

  const [threads, total] = await Promise.all([
    prisma.messageThread.findMany({
      where: baseWhere,
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        subject: true,
        updatedAt: true,
        patient: { select: { fullName: true } },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { body: true },
        },
      },
    }),
    prisma.messageThread.count({ where: baseWhere }),
  ]);

  const lowerQ = q.toLowerCase();

  return {
    hits: threads.map((thread) => {
      const matchingBody = thread.messages.find((m) =>
        m.body.toLowerCase().includes(lowerQ),
      );
      const fallbackBody = thread.messages[0]?.body ?? "";
      const text = matchingBody?.body ?? fallbackBody;

      return {
        type: "message" as const,
        threadId: thread.id,
        subject: thread.subject,
        patientName: thread.patient?.fullName ?? null,
        snippet: snippet(text),
        updatedAt: thread.updatedAt.toISOString(),
      };
    }),
    total,
  };
}

export async function searchOrg(
  ctx: UniversalSearchContext,
  rawQuery: string,
  options?: { limit?: unknown; assignedToMe?: boolean },
): Promise<UniversalSearchResults | null> {
  const query = normalizeQuery(rawQuery);
  if (!query) return null;

  const limit = clampLimit(options?.limit);
  const searchCtx: UniversalSearchContext = {
    ...ctx,
    assignedToMe: options?.assignedToMe,
  };

  const canPatients = canSearch(searchCtx, "patient:read");
  const canTasks = canSearch(searchCtx, "task:read");
  const canMessages = canSearch(searchCtx, "message:read");

  const [patients, tasks, messages] = await Promise.all([
    canPatients ? searchPatients(searchCtx, query, limit) : { hits: [], total: 0 },
    canTasks ? searchTasks(searchCtx, query, limit) : { hits: [], total: 0 },
    canMessages ? searchMessages(searchCtx, query, limit) : { hits: [], total: 0 },
  ]);

  return {
    query,
    patients: patients.hits,
    tasks: tasks.hits,
    messages: messages.hits,
    totals: {
      patients: patients.total,
      tasks: tasks.total,
      messages: messages.total,
    },
    permissions: {
      patients: canPatients,
      tasks: canTasks,
      messages: canMessages,
    },
  };
}
