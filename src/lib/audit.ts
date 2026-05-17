import { prisma } from './prisma'
import { AuditAction } from '@/types'
import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'

interface AuditParams {
  orgId?: string
  actorId: string
  action: AuditAction
  resourceType: string
  resourceId?: string
  patientId?: string
  taskId?: string
  metadata?: Record<string, unknown>
  req?: NextRequest
}

export async function createAuditLog(params: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: params.orgId,
        actorId: params.actorId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        patientId: params.patientId,
        taskId: params.taskId,
        metadata: (params.metadata || {}) as Prisma.InputJsonValue,
        ipAddress: params.req?.headers.get('x-forwarded-for') || params.req?.headers.get('x-real-ip') || undefined,
        userAgent: params.req?.headers.get('user-agent') || undefined,
      }
    })
  } catch (err) {
    // Audit log failures should never crash the main operation
    console.error('[Audit] Failed to create audit log:', err)
  }
}
