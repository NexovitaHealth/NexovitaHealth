export type ClearinghousePayload = {
  orgId: string;
  batchId: string;
  batchNumber: string;
  claimCount: number;
  totalAmount: number;
  payerName?: string | null;
  csvContent: string;
  filename: string;
};

export type ClearinghouseTransmitResult = {
  success: boolean;
  externalRef?: string;
  message: string;
};

export type ClearinghouseTransportMode = "file" | "sftp" | "http";
