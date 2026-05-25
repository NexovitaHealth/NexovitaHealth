import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { deleteS3Object, putS3Object, readS3Object } from "@/lib/s3-signing";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
] as const;

export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

export interface StoredFile {
  key: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export function validateUpload(mimeType: string, size: number) {
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(mimeType as AllowedUploadMimeType)) {
    throw new UploadValidationError("File type not allowed");
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError("File must be 10MB or smaller");
  }
}

class StorageService {
  private provider: "local" | "s3";
  private localBasePath: string;

  constructor() {
    const configured = process.env.STORAGE_PROVIDER || "local";
    // GCS is accessed via its S3-compatible XML API (set S3_ENDPOINT).
    this.provider =
      configured === "local" ? "local" : "s3";
    this.localBasePath = process.env.STORAGE_LOCAL_PATH || "./storage/uploads";
  }

  async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<StoredFile> {
    validateUpload(mimeType, buffer.length);

    const ext = path.extname(originalName);
    const key = `${uuidv4()}${ext}`;

    if (this.provider === "local") {
      return this.uploadLocal(buffer, key, originalName, mimeType);
    }
    await putS3Object(key, buffer, mimeType);
    return {
      key,
      url: this.getUrl(key),
      fileName: originalName,
      mimeType,
      size: buffer.length,
    };
  }

  async delete(key: string): Promise<void> {
    if (this.provider === "local") {
      const filePath = path.join(this.localBasePath, key);
      await fs.unlink(filePath).catch(() => {});
      return;
    }
    await deleteS3Object(key);
  }

  getUrl(key: string): string {
    return `/api/files/${key}`;
  }

  async read(key: string): Promise<{ buffer: Buffer; mimeType?: string }> {
    if (this.provider === "local") {
      const filePath = path.join(this.localBasePath, key);
      const buffer = await fs.readFile(filePath);
      return { buffer };
    }
    return readS3Object(key);
  }

  private async uploadLocal(
    buffer: Buffer,
    key: string,
    originalName: string,
    mimeType: string,
  ): Promise<StoredFile> {
    const dir = this.localBasePath;
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, key);
    await fs.writeFile(filePath, buffer);

    return {
      key,
      url: this.getUrl(key),
      fileName: originalName,
      mimeType,
      size: buffer.length,
    };
  }
}

export const storage = new StorageService();
