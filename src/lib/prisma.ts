/**
 * Prisma Client Singleton
 *
 * Production: Run `prisma generate` then `prisma migrate deploy` before starting.
 * This file uses a lazy singleton pattern to avoid PrismaClient initialization
 * errors during Next.js static build phases.
 */
import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prismaInstance: PrismaClient | undefined
}

function getPrismaClient(): PrismaClient {
  if (!globalThis.__prismaInstance) {
    globalThis.__prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    })
  }
  return globalThis.__prismaInstance
}

// Proxy that defers instantiation until first property access
// This prevents build-time errors when the Prisma engine binary isn't available
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient()
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})

export default prisma
