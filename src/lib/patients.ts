import { z } from "zod";
import type { Patient, PatientStatus, Prisma } from "@prisma/client";

export const PATIENT_STATUSES = [
  "intake",
  "active",
  "on_hold",
  "discharged",
  "deceased",
] as const satisfies readonly PatientStatus[];

export const ADMISSION_SOURCES = [
  "hospital_referral",
  "physician_referral",
  "family_request",
  "skilled_nursing_transfer",
  "community_outreach",
  "readmission",
  "other",
] as const;

export const DISCHARGE_DISPOSITIONS = [
  "home",
  "assisted_living",
  "skilled_nursing",
  "hospice",
  "hospital",
  "deceased",
  "against_medical_advice",
  "other",
] as const;

const optionalEmail = z
  .string()
  .email()
  .optional()
  .or(z.literal("").transform(() => undefined));

const patientFieldsSchema = {
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  email: optionalEmail,
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  primaryDiagnosis: z.string().optional(),
  primaryDiagnosisIcd10: z.string().max(20).optional(),
  admissionSource: z
    .enum(ADMISSION_SOURCES)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  preferredLanguage: z.string().optional(),
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
  whatsappEnrolled: z.boolean().optional(),
  whatsappNumber: z.string().optional(),
};

export const createPatientSchema = z.object({
  fullName: z.string().min(2),
  ...patientFieldsSchema,
  branchId: z.string().uuid().optional(),
});

export const updatePatientSchema = z
  .object({
    fullName: z.string().min(2).optional(),
    ...patientFieldsSchema,
    status: z.enum(PATIENT_STATUSES).optional(),
    dischargeReason: z.string().min(1).optional(),
    dischargeDisposition: z
      .enum(DISCHARGE_DISPOSITIONS)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    dischargeDate: z.string().optional(),
    admissionDate: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const terminal =
      data.status === "discharged" || data.status === "deceased";
    if (terminal && !data.dischargeReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Discharge reason is required when discharging or marking deceased",
        path: ["dischargeReason"],
      });
    }
  });

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

export class PatientWorkflowError extends Error {
  constructor(
    message: string,
    public code:
      | "DISCHARGE_REASON_REQUIRED"
      | "INVALID_STATUS_TRANSITION" = "DISCHARGE_REASON_REQUIRED",
  ) {
    super(message);
    this.name = "PatientWorkflowError";
  }
}

export function admissionSourceLabel(value: string | null | undefined) {
  if (!value) return null;
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function buildPatientCreateData(
  orgId: string,
  userId: string,
  input: CreatePatientInput,
): Prisma.PatientCreateInput {
  return {
    org: { connect: { id: orgId } },
    fullName: input.fullName,
    dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
    gender: input.gender,
    phone: input.phone,
    email: input.email,
    address: input.address,
    city: input.city,
    region: input.region,
    primaryDiagnosis: input.primaryDiagnosis,
    primaryDiagnosisIcd10: input.primaryDiagnosisIcd10,
    admissionSource: input.admissionSource,
    preferredLanguage: input.preferredLanguage,
    allergies: input.allergies ?? [],
    bloodType: input.bloodType,
    insuranceProvider: input.insuranceProvider,
    insuranceNumber: input.insuranceNumber,
    emergencyContact: input.emergencyContact,
    emergencyPhone: input.emergencyPhone,
    isHomeCare: input.isHomeCare ?? true,
    isHospice: input.isHospice ?? false,
    isPalliative: input.isPalliative ?? false,
    riskLevel: input.riskLevel ?? "low",
    admissionDate: new Date(),
    status: "intake",
    secondaryDiagnoses: [],
    ...(input.branchId && { branch: { connect: { id: input.branchId } } }),
    careTeam: {
      create: {
        userId,
        role: "admitting_staff",
        isActive: true,
      },
    },
  };
}

export function buildPatientUpdateData(
  existing: Patient,
  input: UpdatePatientInput,
): Prisma.PatientUpdateInput {
  const data: Prisma.PatientUpdateInput = {};

  const assign = <K extends keyof UpdatePatientInput>(key: K) => {
    if (input[key] !== undefined) {
      (data as Record<string, unknown>)[key as string] = input[key];
    }
  };

  assign("fullName");
  assign("gender");
  assign("phone");
  assign("email");
  assign("address");
  assign("city");
  assign("region");
  assign("primaryDiagnosis");
  assign("primaryDiagnosisIcd10");
  assign("admissionSource");
  assign("preferredLanguage");
  assign("bloodType");
  assign("insuranceProvider");
  assign("insuranceNumber");
  assign("emergencyContact");
  assign("emergencyPhone");
  assign("isHomeCare");
  assign("isHospice");
  assign("isPalliative");
  assign("riskLevel");
  assign("whatsappEnrolled");
  assign("whatsappNumber");

  if (input.dateOfBirth !== undefined) {
    data.dateOfBirth = input.dateOfBirth
      ? new Date(input.dateOfBirth)
      : null;
  }
  if (input.allergies !== undefined) {
    data.allergies = input.allergies;
  }
  if (input.admissionDate !== undefined) {
    data.admissionDate = input.admissionDate
      ? new Date(input.admissionDate)
      : null;
  }

  if (input.status !== undefined) {
    data.status = input.status;
    applyStatusTransition(existing, input, data);
  } else if (input.dischargeReason !== undefined) {
    data.dischargeReason = input.dischargeReason;
  }
  if (input.dischargeDisposition !== undefined) {
    data.dischargeDisposition = input.dischargeDisposition;
  }
  if (input.dischargeDate !== undefined) {
    data.dischargeDate = input.dischargeDate
      ? new Date(input.dischargeDate)
      : null;
  }

  return data;
}

function applyStatusTransition(
  existing: Patient,
  input: UpdatePatientInput,
  data: Prisma.PatientUpdateInput,
) {
  const next = input.status!;
  const prev = existing.status;

  if (next === prev) return;

  if (next === "active" && prev === "intake") {
    if (!existing.admissionDate && !input.admissionDate) {
      data.admissionDate = new Date();
    }
  }

  if (next === "discharged" || next === "deceased") {
    const reason = input.dischargeReason?.trim() || existing.dischargeReason;
    if (!reason) {
      throw new PatientWorkflowError(
        "Discharge reason is required",
        "DISCHARGE_REASON_REQUIRED",
      );
    }
    data.dischargeReason = reason;
    data.dischargeDate = input.dischargeDate
      ? new Date(input.dischargeDate)
      : existing.dischargeDate ?? new Date();
    if (input.dischargeDisposition) {
      data.dischargeDisposition = input.dischargeDisposition;
    } else if (next === "deceased" && !existing.dischargeDisposition) {
      data.dischargeDisposition = "deceased";
    }
  }

  if (
    next === "active" &&
    (prev === "discharged" || prev === "deceased" || prev === "on_hold")
  ) {
    data.dischargeDate = null;
    data.dischargeReason = null;
    data.dischargeDisposition = null;
    if (!existing.admissionDate) {
      data.admissionDate = new Date();
    }
  }
}

export function mapPatientWorkflowError(err: unknown) {
  if (err instanceof PatientWorkflowError) {
    return { message: err.message, status: 400 as const };
  }
  return null;
}
