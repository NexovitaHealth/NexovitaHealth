import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const medicationFieldsSchema = {
  name: z.string().min(1).max(200),
  genericName: z.string().max(200).optional(),
  dosage: z.string().max(100).optional(),
  frequency: z.string().max(100).optional(),
  route: z.string().max(50).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  instructions: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
};

export const createMedicationSchema = z.object(medicationFieldsSchema);

export const updateMedicationSchema = z
  .object({
    ...medicationFieldsSchema,
    name: z.string().min(1).max(200).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type CreateMedicationInput = z.infer<typeof createMedicationSchema>;
export type UpdateMedicationInput = z.infer<typeof updateMedicationSchema>;

export async function getOrgPatientOrThrow(orgId: string, patientId: string) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, orgId, deletedAt: null },
    select: { id: true, fullName: true },
  });
  if (!patient) throw new Error("PATIENT_NOT_FOUND");
  return patient;
}

export async function getOrgMedicationOrThrow(
  orgId: string,
  patientId: string,
  medicationId: string,
) {
  const medication = await prisma.patientMedication.findFirst({
    where: {
      id: medicationId,
      patientId,
      patient: { orgId, deletedAt: null },
    },
  });
  if (!medication) throw new Error("MEDICATION_NOT_FOUND");
  return medication;
}

export function parseOptionalDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

/** PatientMedication has prescribedById only (no User relation on model yet). */
