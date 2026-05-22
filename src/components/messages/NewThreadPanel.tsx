"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PatientMessagePicker } from "@/components/messages/PatientMessagePicker";
import { MessageTemplatePicker } from "@/components/messages/MessageTemplatePicker";
import type { MessageTemplate } from "@/lib/message-templates";

type PatientOption = { id: string; fullName: string };

type CareTeamContact = {
  id: string;
  fullName: string;
  careTeamRole: string;
  userRole: string;
};

type Props = {
  fieldStaffMode: boolean;
  linkedPatient: PatientOption | null;
  onLinkedPatientChange: (patient: PatientOption | null) => void;
  recipientIds: string[];
  onToggleRecipient: (id: string) => void;
  onClearRecipients: () => void;
  newSubject: string;
  onNewSubjectChange: (value: string) => void;
  newContent: string;
  onNewContentChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  onTemplateSelect: (template: MessageTemplate) => void;
  members: Array<{ id: string; fullName: string }>;
  currentUserId?: string;
  onBack?: () => void;
};

export function NewThreadPanel({
  fieldStaffMode,
  linkedPatient,
  onLinkedPatientChange,
  recipientIds,
  onToggleRecipient,
  onClearRecipients,
  newSubject,
  onNewSubjectChange,
  newContent,
  onNewContentChange,
  onSubmit,
  onCancel,
  isSubmitting,
  onTemplateSelect,
  members,
  currentUserId,
  onBack,
}: Props) {
  const { request, orgId } = useApi();

  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ["message-contacts", orgId, linkedPatient?.id],
    queryFn: () =>
      request<{
        patient: PatientOption;
        contacts: CareTeamContact[];
      }>(`/api/orgs/{orgId}/messages/contacts?patientId=${linkedPatient!.id}`),
    enabled: !!orgId && !!linkedPatient?.id && fieldStaffMode,
  });

  const careTeamContacts = contactsData?.data?.contacts ?? [];
  const recipientOptions = fieldStaffMode
    ? careTeamContacts
    : members.filter((m) => m.id !== currentUserId);

  const canSubmit =
    !!newContent.trim() &&
    recipientIds.length > 0 &&
    (!fieldStaffMode || !!linkedPatient);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-0 overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-2 shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="md:hidden p-2 -ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <h2 className="text-base font-semibold text-slate-900">
          {fieldStaffMode ? "Message care team" : "New conversation"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto space-y-5">
          {fieldStaffMode && (
            <p className="text-sm text-slate-500">
              Select a patient, then choose who on the care team should receive
              your message.
            </p>
          )}

          <MessageTemplatePicker
            onSelect={onTemplateSelect}
            audience={fieldStaffMode ? "field" : "clinical"}
          />

          {!fieldStaffMode && (
            <input
              value={newSubject}
              onChange={(e) => onNewSubjectChange(e.target.value)}
              placeholder="Subject (optional)"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 min-h-[44px] text-sm"
            />
          )}

          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">
              {fieldStaffMode ? "Patient" : "Link to patient (optional)"}
            </p>
            <PatientMessagePicker
              value={linkedPatient}
              onChange={(patient) => {
                onLinkedPatientChange(patient);
                if (fieldStaffMode) onClearRecipients();
              }}
              assignedOnly={fieldStaffMode}
            />
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">
              {fieldStaffMode ? "Care team recipients" : "Recipients"}
            </p>
            {fieldStaffMode && linkedPatient && contactsLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading care team…
              </div>
            ) : fieldStaffMode && linkedPatient && recipientOptions.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">
                No other care team members for this patient.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recipientOptions.map((member) => {
                  const label =
                    "careTeamRole" in member
                      ? `${member.fullName} (${member.careTeamRole})`
                      : member.fullName;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => onToggleRecipient(member.id)}
                      disabled={fieldStaffMode && !linkedPatient}
                      className={`px-3 py-2 min-h-[44px] rounded-xl text-sm font-medium border transition-colors ${
                        recipientIds.includes(member.id)
                          ? "bg-[#028090] text-white border-[#028090]"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      } disabled:opacity-50`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {fieldStaffMode && !linkedPatient && (
              <p className="text-xs text-slate-400 mt-2">
                Choose a patient to see care team recipients.
              </p>
            )}
          </div>

          <textarea
            value={newContent}
            onChange={(e) => onNewContentChange(e.target.value)}
            placeholder="Write your message..."
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm min-h-[140px] resize-y"
            required
          />

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || !canSubmit}
              className="px-4 py-3 min-h-[44px] rounded-xl bg-[#028090] text-white text-sm font-medium disabled:opacity-50"
            >
              {isSubmitting ? "Sending…" : "Send message"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-3 min-h-[44px] rounded-xl border border-slate-200 text-sm text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
