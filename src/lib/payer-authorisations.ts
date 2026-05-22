import type { PayerAuthorisationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrgPatientOrThrow } from "@/lib/visits";
import type { AuthContext } from "@/lib/middleware";
import {
  assertAuthorisationManageAccess,
  assertAuthorisationReadAccess,
} from "@/lib/rbac";

export const authorisationInclude = {
  patient: { select: { id: true, fullName: true, insuranceProvider: true } },
} satisfies Prisma.PayerAuthorisationInclude;

export function assertPayerAuthManager(
  auth: Pick<AuthContext, "user" | "orgRole"> | string,
) {
  if (typeof auth === "string") {
    if (!["agency_admin", "billing_manager"].includes(auth)) {
      throw new Error("PAYER_AUTH_FORBIDDEN");
    }
    return;
  }
  assertAuthorisationManageAccess(auth);
}

export function assertPayerAuthReader(
  auth: Pick<AuthContext, "user" | "orgRole"> | string,
) {
  if (typeof auth === "string") {
    if (
      !["agency_admin", "billing_manager", "supervisor", "superadmin"].includes(
        auth,
      )
    ) {
      throw new Error("PAYER_AUTH_FORBIDDEN");
    }
    return;
  }
  assertAuthorisationReadAccess(auth);
}

export async function syncExpiredAuthorisations(
  orgId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const now = new Date();
  await client.payerAuthorisation.updateMany({
    where: {
      orgId,
      deletedAt: null,
      status: { in: ["active", "pending"] },
      endDate: { lt: now },
    },
    data: { status: "expired" },
  });
}

export async function getOrgAuthorisationOrThrow(
  orgId: string,
  authorisationId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const row = await client.payerAuthorisation.findFirst({
    where: { id: authorisationId, orgId, deletedAt: null },
    include: authorisationInclude,
  });
  if (!row) throw new Error("AUTHORISATION_NOT_FOUND");
  return row;
}

export function validateAuthorisationDates(startDate: Date, endDate: Date) {
  if (endDate < startDate) throw new Error("AUTHORISATION_INVALID_DATES");
}

export function remainingUnits(row: {
  unitsAuthorised: number;
  unitsUsed: number;
}) {
  return Math.max(0, row.unitsAuthorised - row.unitsUsed);
}

export function normalizeAuthorisationStatus(
  status: PayerAuthorisationStatus,
  row: { endDate: Date; unitsAuthorised: number; unitsUsed: number },
): PayerAuthorisationStatus {
  if (status === "cancelled") return status;
  if (row.endDate < new Date()) return "expired";
  if (row.unitsUsed >= row.unitsAuthorised) return "exhausted";
  return status;
}

export { getOrgPatientOrThrow };
