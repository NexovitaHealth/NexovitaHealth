import { z } from "zod";

export const clearinghouseConfigSchema = z.object({
  enabled: z.boolean().default(false),
  transport: z.enum(["file", "sftp", "http"]).default("file"),
  sftp: z
    .object({
      host: z.string().min(1),
      port: z.coerce.number().int().min(1).max(65535).default(22),
      username: z.string().min(1),
      remotePath: z.string().min(1).default("/incoming"),
      passwordEnvVar: z.string().min(1).default("CLEARINGHOUSE_SFTP_PASSWORD"),
    })
    .optional(),
  http: z
    .object({
      submitUrl: z.string().url(),
      apiKeyEnvVar: z.string().min(1).default("CLEARINGHOUSE_API_KEY"),
      timeoutMs: z.coerce.number().int().min(1000).max(120000).default(30000),
    })
    .optional(),
});

export type ClearinghouseConfig = z.infer<typeof clearinghouseConfigSchema>;

export type ClearinghouseConfigPublic = {
  enabled: boolean;
  transport: ClearinghouseConfig["transport"];
  sftp?: ClearinghouseConfig["sftp"] & { passwordConfigured: boolean };
  http?: ClearinghouseConfig["http"] & { apiKeyConfigured: boolean };
};

const defaultConfig: ClearinghouseConfig = {
  enabled: false,
  transport: "file",
};

export function parseClearinghouseConfig(
  features: unknown,
): ClearinghouseConfig {
  if (!features || typeof features !== "object" || Array.isArray(features)) {
    return defaultConfig;
  }
  const raw = (features as Record<string, unknown>).clearinghouse;
  const parsed = clearinghouseConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultConfig;
}

export function resolveEnvSecret(envVar?: string) {
  if (!envVar) return undefined;
  const value = process.env[envVar]?.trim();
  return value || undefined;
}

export function toPublicClearinghouseConfig(
  config: ClearinghouseConfig,
): ClearinghouseConfigPublic {
  const result: ClearinghouseConfigPublic = {
    enabled: config.enabled,
    transport: config.transport,
  };
  if (config.sftp) {
    result.sftp = {
      ...config.sftp,
      passwordConfigured: !!resolveEnvSecret(config.sftp.passwordEnvVar),
    };
  }
  if (config.http) {
    result.http = {
      ...config.http,
      apiKeyConfigured: !!resolveEnvSecret(config.http.apiKeyEnvVar),
    };
  }
  return result;
}

export function validateClearinghouseConfig(config: ClearinghouseConfig) {
  if (!config.enabled || config.transport === "file") {
    return { ok: true as const };
  }
  if (config.transport === "sftp") {
    if (!config.sftp?.host || !config.sftp.username) {
      return { ok: false as const, error: "SFTP host and username are required" };
    }
    if (!resolveEnvSecret(config.sftp.passwordEnvVar)) {
      return {
        ok: false as const,
        error: `SFTP password env var ${config.sftp.passwordEnvVar} is not set`,
      };
    }
  }
  if (config.transport === "http") {
    if (!config.http?.submitUrl) {
      return { ok: false as const, error: "HTTP submit URL is required" };
    }
  }
  return { ok: true as const };
}

export async function getOrgClearinghouseConfig(orgId: string) {
  const { prisma } = await import("@/lib/prisma");
  const settings = await prisma.orgSettings.findUnique({
    where: { orgId },
    select: { features: true },
  });
  return parseClearinghouseConfig(settings?.features);
}

export async function saveOrgClearinghouseConfig(
  orgId: string,
  config: ClearinghouseConfig,
) {
  const { prisma } = await import("@/lib/prisma");
  const existing = await prisma.orgSettings.findUnique({
    where: { orgId },
    select: { features: true },
  });
  const features =
    existing?.features &&
    typeof existing.features === "object" &&
    !Array.isArray(existing.features)
      ? { ...(existing.features as Record<string, unknown>) }
      : {};

  await prisma.orgSettings.upsert({
    where: { orgId },
    create: {
      orgId,
      features: { ...features, clearinghouse: config },
    },
    update: {
      features: { ...features, clearinghouse: config },
    },
  });
}
