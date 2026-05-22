import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withOrgAccess } from "@/lib/middleware";
import {
  success,
  created,
  validationError,
  serverError,
  paginated,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { getPagination, getSearchParams } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(async (req, ctx, auth) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const { search, status } = getSearchParams(req);
    const riskLevel = req.nextUrl.searchParams.get("riskLevel") as "low" | null;
    const assignedToMe =
      req.nextUrl.searchParams.get("assignedToMe") === "true";

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
});

const createPatientSchema = z.object({
  fullName: z.string().min(2),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  primaryDiagnosis: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  bloodType: z.string().optional(),
  insuranceProvider: z.string().optional(),
  insuranceNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  isHomeCare: z.boolean().optional(),
  isHospice: z.boolean().optional(),
  isPalliative: z.boolean().optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  branchId: z.string().uuid().optional(),
});

export const POST = withOrgAccess(async (req, _ctx, auth) => {
  try {
    const body = await req.json();
    const parsed = createPatientSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const patient = await prisma.patient.create({
      data: {
        ...parsed.data,
        orgId: auth.orgId!,
        dateOfBirth: parsed.data.dateOfBirth
          ? new Date(parsed.data.dateOfBirth as string)
          : undefined,
        admissionDate: new Date(),
        status: "intake",
        riskLevel: parsed.data.riskLevel ?? "low",
        allergies: parsed.data.allergies ?? [],
        secondaryDiagnoses: [],
        careTeam: {
          create: {
            userId: auth.userId,
            role: "admitting_staff",
            isActive: true,
          },
        },
      },
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "created",
      resourceType: "patient",
      resourceId: patient.id,
      patientId: patient.id,
      metadata: { patientName: patient.fullName },
      req,
    });

    return created(patient);
  } catch (err) {
    return serverError(err);
  }
});
