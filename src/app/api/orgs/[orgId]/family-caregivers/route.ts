import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withOrgAccess } from "@/lib/middleware";
import {
  created,
  error,
  paginated,
  serverError,
  validationError,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { getPagination } from "@/lib/pagination";
import {
  assertFamilyCaregiverManager,
  familyCaregiverInclude,
} from "@/lib/family-caregivers";
import { findOrCreateFamilyCaregiverUser } from "@/lib/portal";
import { getOrgPatientOrThrow } from "@/lib/care-plans";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  patientId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  relationship: z.string().min(1).max(100),
  canViewSchedule: z.boolean().optional(),
  canViewCarePlan: z.boolean().optional(),
  canViewVitals: z.boolean().optional(),
  canMessageCareTeam: z.boolean().optional(),
});

export const GET = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req, 50);
    const patientId = req.nextUrl.searchParams.get("patientId") || undefined;
    const status = req.nextUrl.searchParams.get("status") || undefined;

    const where = {
      orgId: auth.orgId!,
      ...(patientId && { patientId }),
      ...(status && {
        status: status as "pending" | "approved" | "revoked" | "rejected",
      }),
    };

    const [accounts, total] = await Promise.all([
      prisma.familyCaregiverAccount.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: familyCaregiverInclude,
      }),
      prisma.familyCaregiverAccount.count({ where }),
    ]);

    return paginated(accounts, total, page, pageSize);
  } catch (err) {
    return serverError(err);
  }
});

export const POST = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    try {
      assertFamilyCaregiverManager(auth);
    } catch {
      return error("Insufficient permissions to manage family caregivers", 403);
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const data = parsed.data;
    await getOrgPatientOrThrow(auth.orgId!, data.patientId);

    const user = await findOrCreateFamilyCaregiverUser({
      email: data.email,
      fullName: data.fullName,
      phone: data.phone,
    });

    const existing = await prisma.familyCaregiverAccount.findUnique({
      where: {
        patientId_userId: {
          patientId: data.patientId,
          userId: user.id,
        },
      },
    });
    if (existing) {
      return error("This caregiver is already linked to the patient", 409);
    }

    const account = await prisma.familyCaregiverAccount.create({
      data: {
        orgId: auth.orgId!,
        patientId: data.patientId,
        userId: user.id,
        relationship: data.relationship,
        status: "pending",
        canViewSchedule: data.canViewSchedule ?? true,
        canViewCarePlan: data.canViewCarePlan ?? true,
        canViewVitals: data.canViewVitals ?? true,
        canMessageCareTeam: data.canMessageCareTeam ?? true,
      },
      include: familyCaregiverInclude,
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "created",
      resourceType: "family_caregiver_account",
      resourceId: account.id,
      patientId: data.patientId,
      metadata: { email: data.email, status: "pending" },
      req,
    });

    return created(account);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "PATIENT_NOT_FOUND") {
      return error("Patient not found", 404);
    }
    if (message === "FAMILY_CAREGIVER_USER_INACTIVE") {
      return error("Caregiver user account is inactive", 409);
    }
    return serverError(err);
  }
});
