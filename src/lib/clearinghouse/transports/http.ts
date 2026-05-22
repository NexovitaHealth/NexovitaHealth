import type { ClearinghouseConfig } from "@/lib/clearinghouse/config";
import { resolveEnvSecret } from "@/lib/clearinghouse/config";
import type {
  ClearinghousePayload,
  ClearinghouseTransmitResult,
} from "@/lib/clearinghouse/types";

export async function transmitViaHttp(
  config: ClearinghouseConfig,
  payload: ClearinghousePayload,
): Promise<ClearinghouseTransmitResult> {
  const http = config.http;
  if (!http?.submitUrl) {
    throw new Error("CLEARINGHOUSE_HTTP_NOT_CONFIGURED");
  }

  const apiKey = resolveEnvSecret(http.apiKeyEnvVar);
  const body = {
    batchNumber: payload.batchNumber,
    batchId: payload.batchId,
    orgId: payload.orgId,
    filename: payload.filename,
    format: "837-professional-csv",
    claimCount: payload.claimCount,
    totalAmount: payload.totalAmount,
    payerName: payload.payerName,
    fileContentBase64: Buffer.from(payload.csvContent, "utf8").toString("base64"),
  };

  const res = await fetch(http.submitUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      "X-Nexovita-Batch-Number": payload.batchNumber,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(http.timeoutMs ?? 30000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Clearinghouse HTTP ${res.status}: ${text.slice(0, 500) || res.statusText}`,
    );
  }

  let externalRef: string | undefined;
  try {
    const json = JSON.parse(text) as {
      transactionId?: string;
      id?: string;
      reference?: string;
    };
    externalRef =
      json.transactionId ?? json.id ?? json.reference ?? `HTTP-${res.status}`;
  } catch {
    externalRef = `HTTP-${res.status}`;
  }

  return {
    success: true,
    externalRef,
    message: "Batch transmitted via clearinghouse HTTP API",
  };
}
