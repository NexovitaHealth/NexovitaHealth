import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrgAccess } from "@/lib/middleware";
import { createAuditLog } from "@/lib/audit";
import {
  notFound,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import {
  getOrgMedicationOrThrow,
  parseOptionalDate,
  updateMedicationSchema,
} from "@/lib/medications";

export const dynamic = "force-dynamic";

export const PATCH = withOrgAccess(
  async (req: NextRequest, ctx, auth) => {
    try {
      const body = await req.json();
      const parsed = updateMedicationSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error);

      const existing = await getOrgMedicationOrThrow(
        auth.orgId!,
        ctx.params.patientId,
        ctx.params.medicationId,
      );

      const medication = await prisma.patientMedication.update({
        where: { id: existing.id },
        data: {
          name: parsed.data.name,
          genericName: parsed.data.genericName,
          dosage: parsed.data.dosage,
          frequency: parsed.data.frequency,
          route: parsed.data.route,
          instructions: parsed.data.instructions,
          isActive: parsed.data.isActive,
          startDate:
            parsed.data.startDate !== undefined
              ? parseOptionalDate(parsed.data.startDate) ?? null
              : undefined,
          endDate:
            parsed.data.endDate !== undefined
              ? parseOptionalDate(parsed.data.endDate) ?? null
              : undefined,
        },
      });

      await createAuditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        action: "updated",
        resourceType: "patient_medication",
        resourceId: medication.id,
        patientId: existing.patientId,
        metadata: {
          name: medication.name,
          isActive: medication.isActive,
        },
        req,
      });

      return success(medication);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "MEDICATION_NOT_FOUND") {
          return notFound("Medication");
        }
      }
      return serverError(err);
    }
  },
  { permission: "medication:manage" },
);
