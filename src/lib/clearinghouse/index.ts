import type { ClaimBatchTransportStatus } from "@prisma/client";
import {
  getOrgClearinghouseConfig,
  validateClearinghouseConfig,
  type ClearinghouseConfig,
} from "@/lib/clearinghouse/config";
import { transmitViaFile } from "@/lib/clearinghouse/transports/file";
import { transmitViaHttp } from "@/lib/clearinghouse/transports/http";
import { transmitViaSftp } from "@/lib/clearinghouse/transports/sftp";
import type {
  ClearinghousePayload,
  ClearinghouseTransmitResult,
  ClearinghouseTransportMode,
} from "@/lib/clearinghouse/types";
import { prisma } from "@/lib/prisma";

export {
  clearinghouseConfigSchema,
  getOrgClearinghouseConfig,
  saveOrgClearinghouseConfig,
  toPublicClearinghouseConfig,
  validateClearinghouseConfig,
} from "@/lib/clearinghouse/config";
export type { ClearinghouseConfig, ClearinghouseConfigPublic } from "@/lib/clearinghouse/config";

export function resolveTransportMode(
  config: ClearinghouseConfig,
  override?: ClearinghouseTransportMode,
): ClearinghouseTransportMode {
  if (override) return override;
  if (!config.enabled) return "file";
  return config.transport;
}

export async function transmitToClearinghouse(
  config: ClearinghouseConfig,
  mode: ClearinghouseTransportMode,
  payload: ClearinghousePayload,
): Promise<ClearinghouseTransmitResult> {
  if (mode === "file") {
    return transmitViaFile(payload);
  }
  const validation = validateClearinghouseConfig({
    ...config,
    enabled: true,
    transport: mode,
  });
  if (!validation.ok) {
    throw new Error(validation.error);
  }
  if (mode === "sftp") {
    return transmitViaSftp(config, payload);
  }
  if (mode === "http") {
    return transmitViaHttp(config, payload);
  }
  return transmitViaFile(payload);
}

export async function applyBatchTransportResult(
  batchId: string,
  mode: ClearinghouseTransportMode,
  result: ClearinghouseTransmitResult,
  failedError?: string,
) {
  const transportStatus: ClaimBatchTransportStatus = failedError
    ? "failed"
    : mode === "file"
      ? "file_only"
      : "transmitted";

  return prisma.claimSubmissionBatch.update({
    where: { id: batchId },
    data: {
      transportMode: mode,
      transportStatus,
      transportMessage: failedError ?? result.message,
      transmittedAt: failedError ? undefined : new Date(),
      clearinghouseRef: failedError
        ? undefined
        : (result.externalRef ?? undefined),
    },
  });
}

export async function transmitClaimBatch(
  orgId: string,
  batchId: string,
  options?: { transport?: ClearinghouseTransportMode },
) {
  const batch = await prisma.claimSubmissionBatch.findFirst({
    where: { id: batchId, orgId },
    include: {
      claims: {
        include: {
          patient: {
            select: { fullName: true, insuranceProvider: true },
          },
        },
      },
      org: {
        select: {
          name: true,
          npiNumber: true,
          medicareProviderNumber: true,
        },
      },
    },
  });
  if (!batch) throw new Error("BATCH_NOT_FOUND");

  const { build837ProfessionalCsv } = await import("@/lib/claim-submission");
  const csvContent = build837ProfessionalCsv(
    batch.batchNumber,
    batch.org,
    batch.claims,
  );
  const filename = `837-${batch.batchNumber}.csv`;

  const config = await getOrgClearinghouseConfig(orgId);
  const mode = resolveTransportMode(config, options?.transport);

  const payload: ClearinghousePayload = {
    orgId,
    batchId: batch.id,
    batchNumber: batch.batchNumber,
    claimCount: batch.claimCount,
    totalAmount: Number(batch.totalAmount),
    payerName: batch.payerName,
    csvContent,
    filename,
  };

  await prisma.claimSubmissionBatch.update({
    where: { id: batchId },
    data: {
      transportMode: mode,
      transportStatus: mode === "file" ? "file_only" : "pending",
    },
  });

  try {
    const result = await transmitToClearinghouse(config, mode, payload);
    const updated = await applyBatchTransportResult(batchId, mode, result);
    return { batch: updated, exportCsv: csvContent, transport: result };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Clearinghouse transmission failed";
    const updated = await applyBatchTransportResult(
      batchId,
      mode,
      { success: false, message },
      message,
    );
    throw Object.assign(new Error(message), { batch: updated, exportCsv: csvContent });
  }
}

export async function testClearinghouseConnection(
  orgId: string,
  transport: "sftp" | "http",
) {
  const config = await getOrgClearinghouseConfig(orgId);
  const testConfig: ClearinghouseConfig = {
    ...config,
    enabled: true,
    transport,
  };
  const validation = validateClearinghouseConfig(testConfig);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const probe: ClearinghousePayload = {
    orgId,
    batchId: "test",
    batchNumber: "TEST-CONNECT",
    claimCount: 0,
    totalAmount: 0,
    csvContent: "ISA_BATCH,ORG_NAME\nTEST-CONNECT,Connectivity Test\n",
    filename: "837-TEST-CONNECT.csv",
  };

  if (transport === "sftp") {
    const SftpClient = (await import("ssh2-sftp-client")).default;
    const sftp = testConfig.sftp!;
    const password = process.env[sftp.passwordEnvVar]?.trim();
    if (!password) throw new Error("CLEARINGHOUSE_SFTP_PASSWORD_MISSING");
    const client = new SftpClient();
    try {
      await client.connect({
        host: sftp.host,
        port: sftp.port ?? 22,
        username: sftp.username,
        password,
        readyTimeout: 15000,
      });
      await client.list(sftp.remotePath);
      return { ok: true, message: `SFTP connection OK (${sftp.host})` };
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  const http = testConfig.http!;
  const apiKey = process.env[http.apiKeyEnvVar]?.trim();
  const res = await fetch(http.submitUrl, {
    method: "OPTIONS",
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);

  if (!res) {
    await transmitViaHttp(testConfig, probe);
    return { ok: true, message: "HTTP submit endpoint accepted test payload" };
  }

  return {
    ok: res.ok || res.status < 500,
    message: `HTTP endpoint reachable (${res.status})`,
  };
}
