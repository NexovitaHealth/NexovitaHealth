import { z } from "zod";

// =============================================
// Auth Schemas
// =============================================

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  fullName: z.string().min(2, "Full name is required"),
  role: z.enum([
    "AGENCY_ADMIN",
    "SUPERVISOR",
    "PHYSICIAN",
    "PHYSICIAN_INDEPENDENT",
    "HOME_AIDE",
    "BILLING_MANAGER",
    "PATIENT",
    "FAMILY_CAREGIVER",
    "SCHOOL_NURSE",
  ]),
  agencyId: z.string().optional(),
  country: z.enum(["gh", "us", "other"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

// =============================================
// Patient Schemas
// =============================================

export const createPatientSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  phone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.enum(["gh", "us", "other"]).optional(),
  primaryDiagnosis: z.string().optional(),
  secondaryDiagnoses: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  payerId: z.string().optional(),
  careSetting: z.string().optional(),
  primaryAideId: z.string().optional(),
  primaryPhysicianId: z.string().optional(),
  supervisorId: z.string().optional(),
  admissionDate: z.string().optional(),
  emergencyContact: z
    .object({
      name: z.string(),
      relationship: z.string(),
      phone: z.string(),
    })
    .optional(),
  notes: z.string().optional(),
});

export const updatePatientSchema = createPatientSchema.partial().extend({
  status: z
    .enum(["ACTIVE", "DISCHARGED", "DECEASED", "ON_HOLD", "DRAFT"])
    .optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

// =============================================
// Visit Schemas
// =============================================

export const createVisitSchema = z.object({
  patientId: z.string(),
  staffId: z.string(),
  scheduleId: z.string().optional(),
  visitType: z.string().optional(),
  scheduledAt: z.string(),
  notes: z.string().optional(),
});

export const updateVisitSchema = z.object({
  status: z
    .enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "MISSED", "CANCELLED"])
    .optional(),
  checkInAt: z.string().optional(),
  checkOutAt: z.string().optional(),
  checkInLat: z.number().optional(),
  checkInLng: z.number().optional(),
  checkOutLat: z.number().optional(),
  checkOutLng: z.number().optional(),
  notes: z.string().optional(),
  supervisorNotes: z.string().optional(),
});

// =============================================
// Vitals Schemas
// =============================================

export const createVitalSchema = z.object({
  bloodPressureSystolic: z.number().int().min(50).max(300).optional(),
  bloodPressureDiastolic: z.number().int().min(20).max(200).optional(),
  heartRate: z.number().int().min(20).max(300).optional(),
  temperature: z.number().min(30).max(45).optional(),
  oxygenSaturation: z.number().int().min(50).max(100).optional(),
  respiratoryRate: z.number().int().min(4).max(60).optional(),
  weight: z.number().min(1).max(500).optional(),
  height: z.number().min(30).max(250).optional(),
  bloodGlucose: z.number().min(1).max(50).optional(),
  painScore: z.number().int().min(0).max(10).optional(),
  notes: z.string().optional(),
  recordedAt: z.string().optional(),
});

// =============================================
// Care Plan Schemas
// =============================================

export const createCarePlanSchema = z.object({
  title: z.string().min(1),
  goals: z.string().optional(),
  startDate: z.string().optional(),
  reviewDate: z.string().optional(),
  notes: z.string().optional(),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        frequency: z.string().optional(),
        assignedTo: z.string().optional(),
        dueDate: z.string().optional(),
      }),
    )
    .optional(),
});

// =============================================
// Claim Schemas
// =============================================

export const createClaimSchema = z.object({
  patientId: z.string(),
  payerId: z.string().optional(),
  visitId: z.string().optional(),
  serviceDate: z.string().optional(),
  totalAmount: z.number().positive().optional(),
  diagnosisCodes: z.array(z.string()).optional(),
  procedureCodes: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

// =============================================
// Invitation Schemas
// =============================================

export const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum([
    "SUPERVISOR",
    "PHYSICIAN",
    "HOME_AIDE",
    "BILLING_MANAGER",
    "FAMILY_CAREGIVER",
    "SCHOOL_NURSE",
  ]),
});

// =============================================
// Agency Schemas
// =============================================

export const createAgencySchema = z.object({
  name: z.string().min(2, "Agency name is required"),
  country: z.enum(["gh", "us", "other"]).optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  careSettings: z.array(z.string()).optional(),
});
