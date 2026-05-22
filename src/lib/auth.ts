import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from './prisma'
import { NextRequest } from 'next/server'
import {
  SESSION_COOKIE,
  signSessionToken,
  verifySessionToken,
  type SessionJWTPayload,
} from './session-token'

export { SESSION_COOKIE } from './session-token'
export type JWTPayload = SessionJWTPayload

const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(userId: string, ipAddress?: string, userAgent?: string) {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000)
  
  const session = await prisma.session.create({
    data: {
      userId,
      token: crypto.randomUUID(),
      ipAddress,
      userAgent,
      expiresAt,
    }
  })

  const payload: JWTPayload = {
    userId,
    email: '',
    role: '',
    sessionId: session.id,
  }

  const token = await signSessionToken(payload)

  return { token, session, expiresAt }
}

export async function verifySession(token: string): Promise<JWTPayload | null> {
  return verifySessionToken(token)
}

export async function getSessionFromRequest(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null

  const payload = await verifySession(token)
  if (!payload) return null

  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    include: {
      user: {
        include: {
          orgMemberships: {
            include: { org: true },
            where: { org: { deletedAt: null } }
          }
        }
      }
    }
  })

  if (!session || session.expiresAt < new Date()) {
    return null
  }

  return session
}

export async function getCurrentUser(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  return session?.user ?? null
}

export function setSessionCookie(token: string, expiresAt: Date) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}

export function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE)
}
