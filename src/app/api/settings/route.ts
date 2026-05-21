import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { withAuth } from "@/lib/middleware";

export const dynamic = "force-dynamic";

const profileSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  npiNumber: z.string().max(30).nullable().optional(),
  licenseType: z.string().max(80).nullable().optional(),
});

export const GET = withAuth(async (_req: NextRequest, _ctx, auth) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        npiNumber: true,
        licenseType: true,
      },
    });
    return success({ profile: user });
  } catch (err) {
    return serverError(err);
  }
});

export const PATCH = withAuth(async (req: NextRequest, _ctx, auth) => {
  try {
    const body = await req.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const profile = await prisma.user.update({
      where: { id: auth.userId },
      data: parsed.data,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        npiNumber: true,
        licenseType: true,
      },
    });

    return success({ profile });
  } catch (err) {
    return serverError(err);
  }
});
