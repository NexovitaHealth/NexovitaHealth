import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrgAccess } from "@/lib/middleware";
import {
  success,
  created,
  error,
  validationError,
  serverError,
  paginated,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { getPagination, getSearchParams } from "@/lib/pagination";
import { parseAssignedToMeFilter } from "@/lib/patient-list-scope";
import { branchFilter, getOrgBranchOrThrow } from "@/lib/branches";
import {
  buildPatientCreateData,
  createPatientSchema,
} from "@/lib/patients";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(
  async (req, ctx, auth) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const { search, status } = getSearchParams(req);
    const riskLevel = req.nextUrl.searchParams.get("riskLevel") as "low" | null;
    const assignedToMe = parseAssignedToMeFilter(
      auth.user.role,
      req.nextUrl.searchParams.get("assignedToMe"),
    );

    const where = {
      orgId: auth.orgId!,
      deletedAt: null,
      isDraft: false,
      ...(assignedToMe && {
        careTeam: {
          some: { userId: auth.userId, isActive: true },
        },
      }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: "insensitive" as const } },
          {
            primaryDiagnosis: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(status && { status: status as "intake" }),
      ...(riskLevel && { riskLevel }),
      ...branchFilter(auth.activeBranchId, auth.orgHasBranches),
    };

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          fullName: true,
          dateOfBirth: true,
          gender: true,
          photo: true,
          primaryDiagnosis: true,
          status: true,
          riskLevel: true,
          admissionDate: true,
          isHomeCare: true,
          isHospice: true,
          isPalliative: true,
          whatsappEnrolled: true,
          city: true,
          createdAt: true,
          updatedAt: true,
          careTeam: { select: { userId: true, role: true } },
          _count: { select: { alerts: { where: { isResolved: false } } } },
        },
      }),
      prisma.patient.count({ where }),
    ]);

    return paginated(patients, total, page, pageSize);
  } catch (err) {
    return serverError(err);
  }
  },
  { permission: "patient:read" },
);

export const POST = withOrgAccess(
  async (req, _ctx, auth) => {
  try {
    const body = await req.json();
    const parsed = createPatientSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    if (parsed.data.branchId) {
      try {
        await getOrgBranchOrThrow(auth.orgId!, parsed.data.branchId);
      } catch (err) {
        if (err instanceof Error && err.message === "BRANCH_NOT_FOUND") {
          return error("Selected location is not available for this organization", 400);
        }
        throw err;
      }
    } else {
      const branchCount = await prisma.orgBranch.count({
        where: { orgId: auth.orgId!, isActive: true },
      });
      if (branchCount > 0) {
        return error("A location must be selected for this patient", 422);
      }
    }

    const patient = await prisma.patient.create({
      data: buildPatientCreateData(auth.orgId!, auth.userId, parsed.data),
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "created",
      resourceType: "patient",
      resourceId: patient.id,
      patientId: patient.id,
      metadata: {
        patientName: patient.fullName,
        status: patient.status,
        branchId: patient.branchId,
        admissionSource: patient.admissionSource,
      },
      req,
    });

    return created(patient);
  } catch (err) {
    return serverError(err);
  }
  },
  { permission: "patient:create" },
);
