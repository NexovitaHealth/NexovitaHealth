import { ADMISSION_SOURCES, admissionSourceLabel } from "@/lib/patients";
import type { CreatePatientInput } from "@/lib/patients";

export const INTAKE_STEPS = [
  { id: "placement", title: "Placement", description: "Branch and referral" },
  { id: "identity", title: "Identity", description: "Patient demographics" },
  { id: "contact", title: "Contact", description: "Phone and address" },
  { id: "clinical", title: "Clinical", description: "Diagnosis and risk" },
  { id: "coverage", title: "Coverage", description: "Insurance and emergency" },
  { id: "review", title: "Review", description: "Confirm and admit" },
] as const;

export type IntakeStepId = (typeof INTAKE_STEPS)[number]["id"];

export type IntakeFormState = {
  branchId: string;
  admissionSource: string;
  isHomeCare: boolean;
  isHospice: boolean;
  isPalliative: boolean;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  preferredLanguage: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  region: string;
  primaryDiagnosis: string;
  primaryDiagnosisIcd10: string;
  riskLevel: string;
  bloodType: string;
  allergiesText: string;
  insuranceProvider: string;
  insuranceNumber: string;
  emergencyContact: string;
  emergencyPhone: string;
};

export const initialIntakeFormState = (): IntakeFormState => ({
  branchId: "",
  admissionSource: "",
  isHomeCare: true,
  isHospice: false,
  isPalliative: false,
  fullName: "",
  dateOfBirth: "",
  gender: "",
  preferredLanguage: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  region: "",
  primaryDiagnosis: "",
  primaryDiagnosisIcd10: "",
  riskLevel: "low",
  bloodType: "",
  allergiesText: "",
  insuranceProvider: "",
  insuranceNumber: "",
  emergencyContact: "",
  emergencyPhone: "",
});

export function validateIntakeStep(
  step: IntakeStepId,
  form: IntakeFormState,
  options: { requireBranch: boolean },
): string | null {
  switch (step) {
    case "placement":
      if (options.requireBranch && !form.branchId) {
        return "Select a care branch for this patient.";
      }
      return null;
    case "identity":
      if (!form.fullName.trim() || form.fullName.trim().length < 2) {
        return "Full name is required (at least 2 characters).";
      }
      return null;
    case "contact":
    case "clinical":
    case "coverage":
      return null;
    case "review":
      return validateIntakeStep("identity", form, options);
    default:
      return null;
  }
}

export function intakeFormToCreatePayload(
  form: IntakeFormState,
): CreatePatientInput {
  const allergies = form.allergiesText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    fullName: form.fullName.trim(),
    dateOfBirth: form.dateOfBirth || undefined,
    gender: form.gender || undefined,
    phone: form.phone || undefined,
    email: form.email || undefined,
    address: form.address || undefined,
    city: form.city || undefined,
    region: form.region || undefined,
    primaryDiagnosis: form.primaryDiagnosis || undefined,
    primaryDiagnosisIcd10: form.primaryDiagnosisIcd10 || undefined,
    admissionSource: (form.admissionSource || undefined) as
      | CreatePatientInput["admissionSource"]
      | undefined,
    preferredLanguage: form.preferredLanguage || undefined,
    bloodType: form.bloodType || undefined,
    insuranceProvider: form.insuranceProvider || undefined,
    insuranceNumber: form.insuranceNumber || undefined,
    emergencyContact: form.emergencyContact || undefined,
    emergencyPhone: form.emergencyPhone || undefined,
    allergies: allergies.length ? allergies : undefined,
    isHomeCare: form.isHomeCare,
    isHospice: form.isHospice,
    isPalliative: form.isPalliative,
    riskLevel: form.riskLevel as CreatePatientInput["riskLevel"],
    branchId: form.branchId || undefined,
  };
}

export function intakeReviewRows(
  form: IntakeFormState,
  branchName?: string | null,
): Array<{ label: string; value: string }> {
  const careTypes = [
    form.isHomeCare && "Home care",
    form.isHospice && "Hospice",
    form.isPalliative && "Palliative",
  ].filter(Boolean);

  return [
    { label: "Branch", value: branchName || (form.branchId ? "Selected" : "—") },
    {
      label: "Admission source",
      value: admissionSourceLabel(form.admissionSource) || "—",
    },
    { label: "Care type", value: careTypes.join(", ") || "—" },
    { label: "Full name", value: form.fullName || "—" },
    { label: "Date of birth", value: form.dateOfBirth || "—" },
    { label: "Gender", value: form.gender || "—" },
    { label: "Preferred language", value: form.preferredLanguage || "—" },
    { label: "Phone", value: form.phone || "—" },
    { label: "Email", value: form.email || "—" },
    {
      label: "Address",
      value: [form.address, form.city, form.region].filter(Boolean).join(", ") || "—",
    },
    { label: "Primary diagnosis", value: form.primaryDiagnosis || "—" },
    { label: "ICD-10", value: form.primaryDiagnosisIcd10 || "—" },
    { label: "Risk level", value: form.riskLevel || "—" },
    { label: "Allergies", value: form.allergiesText || "—" },
    { label: "Insurance", value: form.insuranceProvider || "—" },
    { label: "Policy number", value: form.insuranceNumber || "—" },
    { label: "Emergency contact", value: form.emergencyContact || "—" },
    { label: "Emergency phone", value: form.emergencyPhone || "—" },
  ];
}

export { ADMISSION_SOURCES, admissionSourceLabel };
