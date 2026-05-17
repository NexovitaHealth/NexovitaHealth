import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, format = 'MMM d, yyyy') {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

export function formatDateTime(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  })
}

export function formatRelative(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return formatDate(d)
}

export function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function riskColor(level: string) {
  switch (level) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-200'
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'low': return 'bg-green-100 text-green-700 border-green-200'
    default: return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

export function statusColor(status: string) {
  switch (status) {
    case 'active': return 'bg-emerald-100 text-emerald-700'
    case 'intake': return 'bg-blue-100 text-blue-700'
    case 'discharged': return 'bg-slate-100 text-slate-600'
    case 'deceased': return 'bg-gray-100 text-gray-600'
    case 'on_hold': return 'bg-amber-100 text-amber-700'
    default: return 'bg-slate-100 text-slate-600'
  }
}

export function priorityColor(priority: string) {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-700'
    case 'high': return 'bg-orange-100 text-orange-700'
    case 'medium': return 'bg-amber-100 text-amber-700'
    case 'low': return 'bg-slate-100 text-slate-600'
    default: return 'bg-slate-100 text-slate-600'
  }
}
