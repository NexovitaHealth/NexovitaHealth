import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from './prisma'
import { NextRequest } from 'next/server'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'nexovita-dev-secret-change-in-production'
)
const SESSION_COOKIE = 'nexovita_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface JWTPayload {
  userId: string
  email: string
  role: string
  sessionId: string
  [key: string]: string  // required by jose JWTPayload
}

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

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(JWT_SECRET)

  return { token, session, expiresAt }
}

export async function verifySession(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
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
