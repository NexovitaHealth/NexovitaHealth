import type { ClearinghouseConfig } from "@/lib/clearinghouse/config";
import { resolveEnvSecret } from "@/lib/clearinghouse/config";
import type {
  ClearinghousePayload,
  ClearinghouseTransmitResult,
} from "@/lib/clearinghouse/types";

export async function transmitViaSftp(
  config: ClearinghouseConfig,
  payload: ClearinghousePayload,
): Promise<ClearinghouseTransmitResult> {
  const sftp = config.sftp;
  if (!sftp?.host || !sftp.username) {
    throw new Error("CLEARINGHOUSE_SFTP_NOT_CONFIGURED");
  }

  const password = resolveEnvSecret(sftp.passwordEnvVar);
  if (!password) {
    throw new Error("CLEARINGHOUSE_SFTP_PASSWORD_MISSING");
  }

  const SftpClient = (await import("ssh2-sftp-client")).default;
  const client = new SftpClient();
  const remoteDir = sftp.remotePath.replace(/\/$/, "");
  const remoteFile = `${remoteDir}/${payload.filename}`;

  try {
    await client.connect({
      host: sftp.host,
      port: sftp.port ?? 22,
      username: sftp.username,
      password,
      readyTimeout: 20000,
    });

    try {
      await client.mkdir(remoteDir, true);
    } catch {
      // directory may already exist
    }

    await client.put(Buffer.from(payload.csvContent, "utf8"), remoteFile);

    return {
      success: true,
      externalRef: `SFTP:${remoteFile}`,
      message: `Uploaded to ${remoteFile}`,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}
