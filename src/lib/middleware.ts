import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from './auth'
import { forbidden, unauthorized } from './api-response'
import { UserRole, OrgRole } from '@/types'

export type AuthenticatedHandler = (
  req: NextRequest,
  context: RouteContext
) => Promise<NextResponse>

export interface RouteContext {
  params: Record<string, string>
}

export interface AuthContext {
  userId: string
  user: {
    id: string
    email: string
    fullName: string
    role: UserRole
    orgMemberships: Array<{
      orgId: string
      role: OrgRole
      org: { id: string; name: string; slug: string }
    }>
  }
  orgId?: string
  orgRole?: OrgRole
}

/**
 * withAuth - wraps an API route handler, injects auth context.
 * Usage: export const GET = withAuth(async (req, ctx, auth) => { ... })
 */
export function withAuth(
  handler: (req: NextRequest, ctx: RouteContext, auth: AuthContext) => Promise<NextResponse>,
  options?: { requiredRoles?: UserRole[]; requiredOrgRoles?: OrgRole[] }
) {
  return async (req: NextRequest, ctx: RouteContext) => {
    const session = await getSessionFromRequest(req)
    if (!session) {
      return unauthorized()
    }

    const { user } = session

    if (options?.requiredRoles && !options.requiredRoles.includes(user.role)) {
      return forbidden()
    }

    // Resolve the org from URL param or header
    const orgSlugOrId = 
      ctx.params?.orgId ||
      req.headers.get('x-org-id') ||
      req.nextUrl.searchParams.get('orgId')

    let orgId: string | undefined
    let orgRole: OrgRole | undefined

    if (orgSlugOrId) {
      const membership = user.orgMemberships.find(
        (m: {orgId: string; role: string; isPrimary: boolean; org: {id: string; name: string; slug: string}}) => m.orgId === orgSlugOrId || m.org.slug === orgSlugOrId
      )
      if (membership) {
        orgId = membership.orgId
        orgRole = membership.role
      }
    }

    if (options?.requiredOrgRoles && orgRole && !options.requiredOrgRoles.includes(orgRole)) {
      return forbidden()
    }

    const auth: AuthContext = {
      userId: user.id,
      user: user as AuthContext['user'],
      orgId,
      orgRole,
    }

    return handler(req, ctx, auth)
  }
}

/**
 * withOrgAccess - ensures user is a member of the org
 */
export function withOrgAccess(
  handler: (req: NextRequest, ctx: RouteContext, auth: AuthContext) => Promise<NextResponse>,
  options?: { requiredOrgRoles?: OrgRole[] }
) {
  return withAuth(async (req, ctx, auth) => {
    if (!auth.orgId) {
      return forbidden('Not a member of this organization')
    }
    if (options?.requiredOrgRoles && auth.orgRole && !options.requiredOrgRoles.includes(auth.orgRole)) {
      return forbidden('Insufficient organization role')
    }
    return handler(req, ctx, auth)
  })
}
