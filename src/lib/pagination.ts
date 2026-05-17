import { NextRequest } from 'next/server'

export interface PaginationParams {
  page: number
  pageSize: number
  skip: number
  take: number
}

export function getPagination(req: NextRequest, defaultPageSize = 20): PaginationParams {
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('pageSize') || String(defaultPageSize))))
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  }
}

export function getSearchParams(req: NextRequest) {
  const params = req.nextUrl.searchParams
  return {
    search: params.get('search') || undefined,
    status: params.get('status') || undefined,
    priority: params.get('priority') || undefined,
    assigneeId: params.get('assigneeId') || undefined,
    sortBy: params.get('sortBy') || 'createdAt',
    sortOrder: (params.get('sortOrder') as 'asc' | 'desc') || 'desc',
  }
}
