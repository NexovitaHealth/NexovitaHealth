import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

export interface StoredFile {
  key: string        // storage key (path or S3 key)
  url: string        // public/signed URL
  fileName: string
  mimeType: string
  size: number
}

/**
 * Storage abstraction that supports local disk and can be swapped for S3.
 * In production, replace the local implementation with @aws-sdk/client-s3.
 */
class StorageService {
  private provider: 'local' | 's3'
  private localBasePath: string

  constructor() {
    this.provider = (process.env.STORAGE_PROVIDER as 'local' | 's3') || 'local'
    this.localBasePath = process.env.STORAGE_LOCAL_PATH || './storage/uploads'
  }

  async upload(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile> {
    const ext = path.extname(originalName)
    const key = `${uuidv4()}${ext}`

    if (this.provider === 'local') {
      return this.uploadLocal(buffer, key, originalName, mimeType)
    }
    // Extend here: return this.uploadS3(buffer, key, originalName, mimeType)
    throw new Error('Unsupported storage provider')
  }

  async delete(key: string): Promise<void> {
    if (this.provider === 'local') {
      const filePath = path.join(this.localBasePath, key)
      await fs.unlink(filePath).catch(() => {}) // Silent fail if not found
      return
    }
    throw new Error('Unsupported storage provider')
  }

  getUrl(key: string): string {
    if (this.provider === 'local') {
      return `/api/files/${key}`
    }
    // For S3: return a presigned URL or CDN URL
    return `/api/files/${key}`
  }

  private async uploadLocal(
    buffer: Buffer,
    key: string,
    originalName: string,
    mimeType: string
  ): Promise<StoredFile> {
    const dir = this.localBasePath
    await fs.mkdir(dir, { recursive: true })
    const filePath = path.join(dir, key)
    await fs.writeFile(filePath, buffer)

    return {
      key,
      url: this.getUrl(key),
      fileName: originalName,
      mimeType,
      size: buffer.length,
    }
  }
}

export const storage = new StorageService()
