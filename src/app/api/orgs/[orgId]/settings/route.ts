import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  forbidden,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";

export const dynamic = "force-dynamic";

const notificationPreferencesSchema = z.object({
  criticalAlerts: z.boolean().optional(),
  newMessages: z.boolean().optional(),
  taskAssigned: z.boolean().optional(),
  patientAdmission: z.boolean().optional(),
  weeklyReport: z.boolean().optional(),
  emailDigest: z.boolean().optional(),
});

const orgSettingsSchema = z.object({
  organization: z
    .object({
      name: z.string().min(2).max(160).optional(),
      address: z.string().max(240).nullable().optional(),
      city: z.string().max(120).nullable().optional(),
      region: z.string().max(120).nullable().optional(),
      phone: z.string().max(40).nullable().optional(),
      email: z.string().email().nullable().optional(),
      website: z.string().url().nullable().optional(),
      medicareProviderNumber: z.string().max(80).nullable().optional(),
      npiNumber: z.string().max(30).nullable().optional(),
    })
    .optional(),
  settings: z
    .object({
      checkinTime: z.string().max(10).optional(),
      summaryTime: z.string().max(10).optional(),
      nationalHealthSystem: z.string().max(120).nullable().optional(),
      primaryCareSetting: z.string().max(120).nullable().optional(),
      supervisingNurse: z.string().max(160).nullable().optional(),
      notificationPreferences: notificationPreferencesSchema.optional(),
    })
    .optional(),
});

function assertCanManageOrgSettings(orgRole?: string) {
  return ["owner", "admin"].includes(orgRole || "");
}

function mergeFeatures(
  current: Prisma.JsonValue,
  notificationPreferences?: z.infer<typeof notificationPreferencesSchema>,
) {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};

  return {
    ...base,
    ...(notificationPreferences
      ? {
          notificationPreferences: {
            ...((base.notificationPreferences as Record<string, unknown>) || {}),
            ...notificationPreferences,
          },
        }
      : {}),
  };
}

export const GET = withOrgAccess(async (_req: NextRequest, _ctx, auth) => {
  try {
    const organization = await prisma.organization.findFirst({
      where: { id: auth.orgId!, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        city: true,
        region: true,
        country: true,
        phone: true,
        email: true,
        website: true,
        medicareProviderNumber: true,
        npiNumber: true,
        settings: true,
      },
    });

    if (!organization?.settings) {
      const settings = await prisma.orgSettings.create({
        data: { orgId: auth.orgId!, features: {} },
      });
      return success({ organization: { ...organization, settings } });
    }

    return success({ organization });
  } catch (err) {
    return serverError(err);
  }
});

export const PATCH = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    if (!assertCanManageOrgSettings(auth.orgRole)) {
      return forbidden("Only organization admins can update agency settings");
    }

    const body = await req.json();
    const parsed = orgSettingsSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const currentSettings = await prisma.orgSettings.upsert({
      where: { orgId: auth.orgId! },
      create: { orgId: auth.orgId!, features: {} },
      update: {},
    });

    const [organization, settings] = await prisma.$transaction([
      prisma.organization.update({
        where: { id: auth.orgId! },
        data: parsed.data.organization ?? {},
        select: {
          id: true,
          name: true,
          slug: true,
          address: true,
          city: true,
          region: true,
          country: true,
          phone: true,
          email: true,
          website: true,
          medicareProviderNumber: true,
          npiNumber: true,
        },
      }),
      prisma.orgSettings.update({
        where: { orgId: auth.orgId! },
        data: parsed.data.settings
          ? {
              checkinTime: parsed.data.settings.checkinTime,
              summaryTime: parsed.data.settings.summaryTime,
              nationalHealthSystem:
                parsed.data.settings.nationalHealthSystem,
              primaryCareSetting: parsed.data.settings.primaryCareSetting,
              supervisingNurse: parsed.data.settings.supervisingNurse,
              features: mergeFeatures(
                currentSettings.features,
                parsed.data.settings.notificationPreferences,
              ) as Prisma.InputJsonValue,
            }
          : {},
      }),
    ]);

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "updated",
      resourceType: "org_settings",
      resourceId: auth.orgId,
      metadata: {
        organizationFields: Object.keys(parsed.data.organization || {}),
        settingsFields: Object.keys(parsed.data.settings || {}),
      },
      req,
    });

    return success({ organization: { ...organization, settings } });
  } catch (err) {
    return serverError(err);
  }
});
