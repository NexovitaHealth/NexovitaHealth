import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { claimInclude } from "@/lib/billing";
import type { ClearinghouseTransportMode } from "@/lib/clearinghouse/types";

export function makeBatchNumber(orgSlug: string) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${orgSlug.toUpperCase().slice(0, 8)}-${date}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

function csvEscape(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export function build837ProfessionalCsv(
  batchNumber: string,
  org: { name: string; npiNumber?: string | null; medicareProviderNumber?: string | null },
  claims: Array<{
    claimNumber: string | null;
    payerName: string;
    serviceCode: string;
    serviceDate: Date;
    units: number;
    totalAmount: Prisma.Decimal | number;
    patient: { fullName: string; insuranceProvider: string | null };
    diagnosisCodes: unknown;
  }>,
) {
  const headers = [
    "ISA_BATCH",
    "ORG_NAME",
    "ORG_NPI",
    "MEDICARE_PROVIDER",
    "CLAIM_NUMBER",
    "PATIENT_NAME",
    "PAYER",
    "MEMBER_ID",
    "SERVICE_DATE",
    "PROCEDURE",
    "UNITS",
    "CHARGE",
    "DIAGNOSIS",
  ];
  const rows = claims.map((claim) => {
    const dx = Array.isArray(claim.diagnosisCodes)
      ? (claim.diagnosisCodes as string[]).join("|")
      : "";
    const amount =
      typeof claim.totalAmount === "number"
        ? claim.totalAmount.toFixed(2)
        : Number(claim.totalAmount).toFixed(2);

    return [
      batchNumber,
      org.name,
      org.npiNumber ?? "",
      org.medicareProviderNumber ?? "",
      claim.claimNumber ?? "",
      claim.patient.fullName,
      claim.payerName,
      claim.patient.insuranceProvider ?? "",
      formatDate(claim.serviceDate),
      claim.serviceCode,
      String(claim.units),
      amount,
      dx,
    ]
      .map(csvEscape)
      .join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

export async function submitClaimBatch(
  orgId: string,
  submittedById: string,
  options: {
    claimIds?: string[];
    payerName?: string;
    transport?: ClearinghouseTransportMode;
  },
) {
  const org = await prisma.organization.findFirst({
    where: { id: orgId, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      npiNumber: true,
      medicareProviderNumber: true,
    },
  });
  if (!org) throw new Error("ORG_NOT_FOUND");

  const where: Prisma.ClaimWhereInput = {
    orgId,
    status: "queued",
    deletedAt: null,
    submissionBatchId: null,
  };
  if (options.claimIds?.length) {
    where.id = { in: options.claimIds };
  }
  if (options.payerName) {
    where.payerName = options.payerName;
  }

  const claims = await prisma.claim.findMany({
    where,
    include: claimInclude,
    orderBy: { serviceDate: "asc" },
  });
  if (claims.length === 0) throw new Error("NO_CLAIMS_TO_SUBMIT");

  const totalAmount = claims.reduce(
    (sum, c) => sum + Number(c.totalAmount),
    0,
  );
  const batchNumber = makeBatchNumber(org.slug);
  const {
    getOrgClearinghouseConfig,
    resolveTransportMode,
    transmitToClearinghouse,
    applyBatchTransportResult,
  } = await import("@/lib/clearinghouse");
  const chConfig = await getOrgClearinghouseConfig(orgId);
  const transportMode = resolveTransportMode(chConfig, options.transport);

  let batch = await prisma.$transaction(async (tx) => {
    const created = await tx.claimSubmissionBatch.create({
      data: {
        orgId,
        batchNumber,
        claimCount: claims.length,
        totalAmount,
        payerName: options.payerName ?? claims[0]?.payerName,
        clearinghouseRef: `CH-${batchNumber}`,
        transportMode,
        transportStatus: transportMode === "file" ? "file_only" : "pending",
        submittedById,
        status: "submitted",
      },
    });

    const now = new Date();
    await tx.claim.updateMany({
      where: { id: { in: claims.map((c) => c.id) } },
      data: {
        status: "submitted",
        submissionBatchId: created.id,
        submittedAt: now,
      },
    });

    return tx.claimSubmissionBatch.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        submittedBy: { select: { id: true, fullName: true } },
        claims: { include: claimInclude },
      },
    });
  });

  const exportCsv = build837ProfessionalCsv(batchNumber, org, batch.claims);
  const filename = `837-${batchNumber}.csv`;

  let transportError: string | undefined;
  let transportResult;
  try {
    transportResult = await transmitToClearinghouse(chConfig, transportMode, {
      orgId,
      batchId: batch.id,
      batchNumber,
      claimCount: batch.claimCount,
      totalAmount: Number(batch.totalAmount),
      payerName: batch.payerName,
      csvContent: exportCsv,
      filename,
    });
    await applyBatchTransportResult(batch.id, transportMode, transportResult);
  } catch (err) {
    transportError =
      err instanceof Error ? err.message : "Clearinghouse transmission failed";
    await applyBatchTransportResult(
      batch.id,
      transportMode,
      { success: false, message: transportError },
      transportError,
    );
  }

  batch = await prisma.claimSubmissionBatch.findUniqueOrThrow({
    where: { id: batch.id },
    include: {
      submittedBy: { select: { id: true, fullName: true } },
      claims: { include: claimInclude },
    },
  });

  return { batch, exportCsv, transportError, transportResult };
}

export async function getSubmissionBatchExport(orgId: string, batchId: string) {
  const batch = await prisma.claimSubmissionBatch.findFirst({
    where: { id: batchId, orgId },
    include: {
      claims: { include: claimInclude },
      org: {
        select: {
          name: true,
          npiNumber: true,
          medicareProviderNumber: true,
        },
      },
    },
  });
  if (!batch) return null;

  return {
    batch,
    exportCsv: build837ProfessionalCsv(
      batch.batchNumber,
      batch.org,
      batch.claims,
    ),
  };
}
