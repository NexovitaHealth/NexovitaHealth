import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrgAccess } from "@/lib/middleware";
import { createAuditLog } from "@/lib/audit";
import {
  created,
  notFound,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import {
  createMedicationSchema,
  getOrgPatientOrThrow,
  parseOptionalDate,
} from "@/lib/medications";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(
  async (req: NextRequest, ctx, auth) => {
    try {
      const patient = await getOrgPatientOrThrow(
        auth.orgId!,
        ctx.params.patientId,
      );
      const activeOnly =
        req.nextUrl.searchParams.get("activeOnly") !== "false";

      const medications = await prisma.patientMedication.findMany({
        where: {
          patientId: patient.id,
          ...(activeOnly && { isActive: true }),
        },
        orderBy: { createdAt: "desc" },
      });

      return success(medications);
    } catch (err) {
      if (err instanceof Error && err.message === "PATIENT_NOT_FOUND") {
        return notFound("Patient");
      }
      return serverError(err);
    }
  },
  { permission: "medication:read" },
);

export const POST = withOrgAccess(
  async (req: NextRequest, ctx, auth) => {
    try {
      const body = await req.json();
      const parsed = createMedicationSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error);

      const patient = await getOrgPatientOrThrow(
        auth.orgId!,
        ctx.params.patientId,
      );

      const medication = await prisma.patientMedication.create({
        data: {
          patientId: patient.id,
          prescribedById: auth.userId,
          name: parsed.data.name,
          genericName: parsed.data.genericName,
          dosage: parsed.data.dosage,
          frequency: parsed.data.frequency,
          route: parsed.data.route,
          instructions: parsed.data.instructions,
          isActive: parsed.data.isActive ?? true,
          startDate: parseOptionalDate(parsed.data.startDate),
          endDate: parseOptionalDate(parsed.data.endDate),
        },
      });

      await createAuditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        action: "created",
        resourceType: "patient_medication",
        resourceId: medication.id,
        patientId: patient.id,
        metadata: { name: medication.name },
        req,
      });

      return created(medication);
    } catch (err) {
      if (err instanceof Error && err.message === "PATIENT_NOT_FOUND") {
        return notFound("Patient");
      }
      return serverError(err);
    }
  },
  { permission: "medication:manage" },
);
