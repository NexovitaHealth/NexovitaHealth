import type { ClearinghousePayload, ClearinghouseTransmitResult } from "@/lib/clearinghouse/types";

export async function transmitViaFile(
  payload: ClearinghousePayload,
): Promise<ClearinghouseTransmitResult> {
  return {
    success: true,
    externalRef: `FILE-${payload.batchNumber}`,
    message: "837 CSV ready for manual clearinghouse upload",
  };
}
