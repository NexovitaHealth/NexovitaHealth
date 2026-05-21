import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { success, serverError, validationError } from "@/lib/api-response";
import { sendPasswordResetEmail } from "@/lib/email";
import { createPasswordResetToken } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    // Always return 200 to prevent user enumeration
    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null, isActive: true },
      select: { id: true, email: true },
    });
    if (user) {
      const reset = createPasswordResetToken();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: reset.tokenHash,
          resetTokenExpiry: reset.expiresAt,
        },
      });

      await sendPasswordResetEmail(user.email, reset.token).catch((err) => {
        console.error("[Password Reset] Failed to send reset email", err);
      });
    }

    return success({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
