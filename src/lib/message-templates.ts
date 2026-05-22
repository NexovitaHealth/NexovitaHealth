export type MessageTemplate = {
  id: string;
  label: string;
  subject?: string;
  body: string;
};

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "visit_followup",
    label: "Visit follow-up",
    subject: "Visit follow-up",
    body: "Following today's visit, please review the patient's status and let me know if any orders or follow-up visits are needed.",
  },
  {
    id: "care_plan_review",
    label: "Care plan review",
    subject: "Care plan review requested",
    body: "Please review the active care plan and confirm goals, interventions, and physician orders are current for this patient.",
  },
  {
    id: "medication_clarification",
    label: "Medication question",
    subject: "Medication clarification",
    body: "I need clarification on the current medication list or recent changes. Please confirm active orders and any hold/discontinue instructions.",
  },
  {
    id: "schedule_change",
    label: "Schedule change",
    subject: "Schedule update",
    body: "There is a requested change to the visit schedule. Please confirm availability and update the calendar as needed.",
  },
  {
    id: "urgent_clinical",
    label: "Urgent clinical",
    subject: "Urgent — clinical attention needed",
    body: "Urgent: please review this patient as soon as possible. Clinical concern requires supervisor/physician input today.",
  },
  {
    id: "family_update",
    label: "Family update",
    subject: "Family / caregiver update",
    body: "Sharing an update regarding the patient or family caregiver communication. Please acknowledge when you have reviewed.",
  },
];

export function getMessageTemplate(id: string) {
  return MESSAGE_TEMPLATES.find((t) => t.id === id);
}
