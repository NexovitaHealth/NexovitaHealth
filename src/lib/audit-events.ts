import type { Claim } from "@prisma/client";
import type { NextRequest } from "next/server";
import { createAuditLog } from "@/lib/audit";
import type { AuditAction } from "@/types";

type ClaimPatchInput = {
  status?: Claim["status"];
  denialReason?: string;
  paymentReference?: string;
  paidAmount?: number;
};

export function buildClaimAuditEvent(
  before: Claim,
  after: Claim,
  input: ClaimPatchInput,
  options?: { unitsRestoredOnVoid?: number },
): { action: AuditAction; metadata: Record<string, unknown> } {
  const statusChanged =
    input.status !== undefined && input.status !== before.status;

  const metadata: Record<string, unknown> = {
    claimNumber: after.claimNumber,
    previousStatus: before.status,
    status: after.status,
  };

  if (statusChanged && input.status === "voided") {
    metadata.voided = true;
    if (options?.unitsRestoredOnVoid) {
      metadata.unitsRestored = options.unitsRestoredOnVoid;
      metadata.authorisationId = after.authorisationId;
    }
  }

  if (input.status === "denied" || after.status === "denied") {
    if (input.denialReason ?? after.denialReason) {
      metadata.denialReason = input.denialReason ?? after.denialReason;
    }
  }

  if (input.paymentReference) {
    metadata.paymentReference = input.paymentReference;
  }
  if (input.paidAmount !== undefined) {
    metadata.paidAmount = input.paidAmount;
  }

  if (statusChanged) {
    return { action: "status_changed", metadata };
  }

  const paymentOrMetaChanged =
    input.denialReason !== undefined ||
    input.paymentReference !== undefined ||
    input.paidAmount !== undefined;

  if (paymentOrMetaChanged) {
    return { action: "updated", metadata: { ...metadata, billingUpdate: true } };
  }

  return { action: "updated", metadata };
}

export async function auditMessageSent(params: {
  orgId: string;
  actorId: string;
  messageId: string;
  threadId: string;
  patientId?: string | null;
  channel: "staff" | "portal";
  preview: string;
  threadCreated?: boolean;
  portalSubjectType?: string;
  req?: NextRequest;
}) {
  await createAuditLog({
    orgId: params.orgId,
    actorId: params.actorId,
    action: "created",
    resourceType: params.channel === "portal" ? "portal_message" : "message",
    resourceId: params.messageId,
    patientId: params.patientId ?? undefined,
    metadata: {
      threadId: params.threadId,
      channel: params.channel,
      preview: params.preview.slice(0, 200),
      ...(params.threadCreated && { threadCreated: true }),
      ...(params.portalSubjectType && {
        portalSubjectType: params.portalSubjectType,
      }),
    },
    req: params.req,
  });
}

export function formatAuditMetadata(
  resourceType: string,
  metadata?: Record<string, unknown> | null,
): string {
  if (!metadata || typeof metadata !== "object") return "—";

  const m = metadata as Record<string, unknown>;

  if (resourceType === "portal_message" || resourceType === "message") {
    const parts = [
      m.channel && String(m.channel),
      m.threadCreated && "new thread",
      m.preview && `"${String(m.preview).slice(0, 60)}"`,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Message sent";
  }

  if (resourceType === "claim") {
    const parts: string[] = [];
    if (m.previousStatus && m.status && m.previousStatus !== m.status) {
      parts.push(`${m.previousStatus} → ${m.status}`);
    } else if (m.status) {
      parts.push(String(m.status));
    }
    if (m.claimNumber) parts.push(`#${m.claimNumber}`);
    if (m.voided) {
      parts.push("voided");
      if (m.unitsRestored) parts.push(`${m.unitsRestored} units restored`);
    }
    if (m.denialReason) parts.push(`denial: ${String(m.denialReason).slice(0, 40)}`);
    if (m.paidAmount !== undefined) parts.push(`paid $${m.paidAmount}`);
    if (m.paymentReference) parts.push(`ref ${m.paymentReference}`);
    return parts.length ? parts.join(" · ") : "Claim update";
  }

  const keys = Object.keys(m).slice(0, 4);
  if (!keys.length) return "—";
  return keys
    .map((k) => `${k}: ${String(m[k]).slice(0, 40)}`)
    .join(" · ");
}
