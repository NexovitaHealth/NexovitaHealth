import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { error, serverError, success, validationError } from "@/lib/api-response";
import { hashPassword } from "@/lib/auth";
import { hashPasswordResetToken } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const tokenHash = hashPasswordResetToken(parsed.data.token);
    const user = await prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExpiry: { gt: new Date() },
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    });

    if (!user) return error("Invalid or expired reset token", 400);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(parsed.data.password),
          resetToken: null,
          resetTokenExpiry: null,
        },
      }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);

    return success({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
