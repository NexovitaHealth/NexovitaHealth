import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RecordClaimPaymentInput = {
  orgId: string;
  claimId: string;
  recordedById: string;
  amount: number;
  paymentReference?: string;
  paymentMethod?: string;
  paidAt?: Date;
  notes?: string;
};

export async function recordClaimPayment(
  input: RecordClaimPaymentInput,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  return client.claimPayment.create({
    data: {
      orgId: input.orgId,
      claimId: input.claimId,
      recordedById: input.recordedById,
      amount: input.amount,
      paymentReference: input.paymentReference,
      paymentMethod: input.paymentMethod,
      paidAt: input.paidAt ?? new Date(),
      notes: input.notes,
    },
  });
}

export async function getClaimPaymentTotal(
  claimId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const result = await client.claimPayment.aggregate({
    where: { claimId },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}
