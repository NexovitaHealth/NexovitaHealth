export type MessageTemplate = {
  id: string;
  label: string;
  subject?: string;
  body: string;
  audience?: "all" | "field" | "clinical";
};

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "visit_followup",
    label: "Visit follow-up",
    subject: "Visit follow-up",
    body: "Following today's visit, please review the patient's status and let me know if any orders or follow-up visits are needed.",
    audience: "clinical",
  },
  {
    id: "care_plan_review",
    label: "Care plan review",
    subject: "Care plan review requested",
    body: "Please review the active care plan and confirm goals, interventions, and physician orders are current for this patient.",
    audience: "clinical",
  },
  {
    id: "medication_clarification",
    label: "Medication question",
    subject: "Medication clarification",
    body: "I need clarification on the current medication list or recent changes. Please confirm active orders and any hold/discontinue instructions.",
    audience: "clinical",
  },
  {
    id: "schedule_change",
    label: "Schedule change",
    subject: "Schedule update",
    body: "There is a requested change to the visit schedule. Please confirm availability and update the calendar as needed.",
    audience: "clinical",
  },
  {
    id: "urgent_clinical",
    label: "Urgent clinical",
    subject: "Urgent — clinical attention needed",
    body: "Urgent: please review this patient as soon as possible. Clinical concern requires supervisor/physician input today.",
    audience: "clinical",
  },
  {
    id: "family_update",
    label: "Family update",
    subject: "Family / caregiver update",
    body: "Sharing an update regarding the patient or family caregiver communication. Please acknowledge when you have reviewed.",
    audience: "clinical",
  },
  {
    id: "field_visit_update",
    label: "Visit update",
    subject: "Visit update",
    body: "Visit completed. Patient status stable. No immediate concerns to report.",
    audience: "field",
  },
  {
    id: "field_running_late",
    label: "Running late",
    subject: "Running late",
    body: "I am running late for the scheduled visit. Estimated arrival in 15–20 minutes.",
    audience: "field",
  },
  {
    id: "field_need_help",
    label: "Need supervisor",
    subject: "Need supervisor assistance",
    body: "I need supervisor assistance during this visit. Please call or message back as soon as you can.",
    audience: "field",
  },
  {
    id: "field_patient_concern",
    label: "Patient concern",
    subject: "Clinical concern during visit",
    body: "I observed a clinical concern during today's visit that needs review. Details in message below.",
    audience: "field",
  },
  {
    id: "field_supply_needed",
    label: "Supply needed",
    subject: "Supply / equipment needed",
    body: "We need additional supplies or equipment for this patient's care plan. Please advise on next steps.",
    audience: "field",
  },
];

export function getMessageTemplate(id: string) {
  return MESSAGE_TEMPLATES.find((t) => t.id === id);
}

export function getMessageTemplatesForAudience(
  audience: "clinical" | "field" | "all",
): MessageTemplate[] {
  if (audience === "all") return MESSAGE_TEMPLATES;
  return MESSAGE_TEMPLATES.filter(
    (template) => template.audience === audience || template.audience === "all",
  );
}
