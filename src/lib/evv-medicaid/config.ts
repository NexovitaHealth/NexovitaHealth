import { z } from "zod";

export const medicaidEvvConfigSchema = z.object({
  medicaidProviderId: z.string().max(80).default(""),
  officeId: z.string().max(80).default(""),
  payerId: z.string().max(80).default(""),
  stateCode: z.string().max(2).default(""),
  defaultServiceCode: z.string().max(20).default("S5135"),
  timezone: z.string().max(64).default("America/Chicago"),
});

export type MedicaidEvvConfig = z.infer<typeof medicaidEvvConfigSchema>;

const defaultConfig: MedicaidEvvConfig = {
  medicaidProviderId: "",
  officeId: "",
  payerId: "",
  stateCode: "",
  defaultServiceCode: "S5135",
  timezone: "America/Chicago",
};

export function parseMedicaidEvvConfig(features: unknown): MedicaidEvvConfig {
  if (!features || typeof features !== "object" || Array.isArray(features)) {
    return defaultConfig;
  }
  const raw = (features as Record<string, unknown>).medicaidEvv;
  const parsed = medicaidEvvConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultConfig;
}

export function validateMedicaidEvvConfig(
  config: MedicaidEvvConfig,
  orgNpi?: string | null,
) {
  if (!config.medicaidProviderId.trim() && !orgNpi?.trim()) {
    return {
      ok: false as const,
      error:
        "Configure Medicaid Provider ID in EVV settings or organization NPI before exporting",
    };
  }
  return { ok: true as const };
}

export async function saveMedicaidEvvConfig(
  prisma: {
    orgSettings: {
      findUnique: (args: {
        where: { orgId: string };
        select: { features: true };
      }) => Promise<{ features: unknown } | null>;
      update: (args: {
        where: { orgId: string };
        data: { features: object };
      }) => Promise<unknown>;
    };
  },
  orgId: string,
  config: MedicaidEvvConfig,
) {
  const current = await prisma.orgSettings.findUnique({
    where: { orgId },
    select: { features: true },
  });
  const features =
    current?.features &&
    typeof current.features === "object" &&
    !Array.isArray(current.features)
      ? { ...(current.features as Record<string, unknown>) }
      : {};

  await prisma.orgSettings.update({
    where: { orgId },
    data: {
      features: { ...features, medicaidEvv: config },
    },
  });
}
