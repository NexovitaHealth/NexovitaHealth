import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

// All responses follow: { success, data, pagination?, error? }
export function success<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function created<T>(data: T) {
  return success(data, 201)
}

export function error(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, error: message, ...(details ? { details } : {}) },
    { status }
  )
}

export function unauthorized(message = 'Unauthorized') {
  return error(message, 401)
}

export function forbidden(message = 'Forbidden') {
  return error(message, 403)
}

export function notFound(resource = 'Resource') {
  return error(`${resource} not found`, 404)
}

export function validationError(err: ZodError) {
  return error('Validation failed', 422, err.flatten().fieldErrors)
}

export function serverError(err: unknown) {
  console.error('[Server Error]', err)
  const message = err instanceof Error ? err.message : 'Internal server error'
  return error(
    process.env.NODE_ENV === 'development' ? message : 'Internal server error',
    500
  )
}

/**
 * Paginated response — data is the array, pagination is top-level.
 * Response shape: { success, data: T[], pagination: { total, page, pageSize, totalPages, hasMore } }
 */
export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: page * pageSize < total,
    },
  })
}
