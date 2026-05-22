import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withOrgAccess } from "@/lib/middleware";
import { createAuditLog } from "@/lib/audit";
import { error, forbidden, serverError, success, validationError } from "@/lib/api-response";
import {
  medicaidEvvConfigSchema,
  parseMedicaidEvvConfig,
  saveMedicaidEvvConfig,
} from "@/lib/evv-medicaid";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  medicaidEvv: medicaidEvvConfigSchema,
});

export const GET = withOrgAccess(
  async (_req: NextRequest, _ctx, auth) => {
    try {
      const [org, settings] = await Promise.all([
        prisma.organization.findFirst({
          where: { id: auth.orgId!, deletedAt: null },
          select: { npiNumber: true, region: true, medicareProviderNumber: true },
        }),
        prisma.orgSettings.findUnique({
          where: { orgId: auth.orgId! },
          select: { features: true },
        }),
      ]);

      return success({
        medicaidEvv: parseMedicaidEvvConfig(settings?.features),
        orgNpi: org?.npiNumber,
        orgRegion: org?.region,
        medicareProviderNumber: org?.medicareProviderNumber,
      });
    } catch (err) {
      return serverError(err);
    }
  },
  { permission: "visit:read" },
);

export const PATCH = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
    try {
      if (!["owner", "admin"].includes(auth.orgRole || "")) {
        return forbidden("Only organization admins can update EVV settings");
      }

      const body = await req.json();
      const parsed = patchSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error);

      await prisma.orgSettings.upsert({
        where: { orgId: auth.orgId! },
        create: { orgId: auth.orgId!, features: { medicaidEvv: parsed.data.medicaidEvv } },
        update: {},
      });

      await saveMedicaidEvvConfig(prisma, auth.orgId!, parsed.data.medicaidEvv);

      await createAuditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        action: "updated",
        resourceType: "evv_settings",
        resourceId: auth.orgId,
        metadata: { fields: Object.keys(parsed.data.medicaidEvv) },
        req,
      });

      return success({ medicaidEvv: parsed.data.medicaidEvv });
    } catch (err) {
      return serverError(err);
    }
  },
  { permission: "visit:read" },
);
