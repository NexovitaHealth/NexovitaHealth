/** Parse ?assignedToMe= for org patient list (physicians default to care-team scope). */
export function parseAssignedToMeFilter(
  userRole: string,
  assignedToMeParam: string | null,
): boolean {
  const isPhysician = ["physician", "physician_independent"].includes(userRole);
  if (isPhysician) {
    return assignedToMeParam !== "false";
  }
  return assignedToMeParam === "true";
}

export type PatientCaseloadScope = "assigned" | "all";

export function caseloadScopeFromParam(
  physicianMode: boolean,
  assignedToMeParam: string | null,
): PatientCaseloadScope {
  if (!physicianMode) {
    return assignedToMeParam === "true" ? "assigned" : "all";
  }
  return assignedToMeParam === "false" ? "all" : "assigned";
}

export function assignedToMeFromScope(
  physicianMode: boolean,
  scope: PatientCaseloadScope,
): boolean {
  if (!physicianMode) return scope === "assigned";
  return scope === "assigned";
}
