import { NextRequest } from "next/server";
import { z } from "zod";
import { error, serverError, success, validationError } from "@/lib/api-response";
import { markEmailBounced } from "@/lib/email-delivery";

export const dynamic = "force-dynamic";

const eventSchema = z.object({
  messageId: z.string().min(1),
  event: z.enum(["bounce", "complaint", "delivered"]),
  reason: z.string().optional(),
});

function assertWebhookSecret(req: NextRequest) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret) throw new Error("WEBHOOK_NOT_CONFIGURED");
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token !== secret) throw new Error("WEBHOOK_UNAUTHORIZED");
}

export async function POST(req: NextRequest) {
  try {
    assertWebhookSecret(req);

    const body = await req.json();
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    if (parsed.data.event === "bounce" || parsed.data.event === "complaint") {
      const updated = await markEmailBounced(
        parsed.data.messageId,
        parsed.data.reason,
      );
      return success({ updated: Boolean(updated) });
    }

    return success({ updated: false });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "WEBHOOK_NOT_CONFIGURED") {
        return error("EMAIL_WEBHOOK_SECRET is not configured", 503);
      }
      if (err.message === "WEBHOOK_UNAUTHORIZED") {
        return error("Unauthorized", 401);
      }
    }
    return serverError(err);
  }
}
