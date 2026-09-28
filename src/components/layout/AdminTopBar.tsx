'use client'

import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'
import { logout } from '@/actions/auth'

// ─── Component ───────────────────────────────────────────────────────

export interface AdminTopBarProps {
  email: string
  className?: string
}

export function AdminTopBar({ email, className }: AdminTopBarProps) {
  const pathname = usePathname()
  const section = getSectionName(pathname)

  return (
    <header className={cn('admin-topbar', className)}>
      <span className="admin-breadcrumb">
        Admin / <strong>{section}</strong>
      </span>

      <div className="admin-topbar-actions">
        <span className="admin-account">{email}</span>
        <form action={logout}>
          <button type="submit" className="admin-button admin-button-bare">
            Log out
          </button>
        </form>
      </div>
    </header>
  )
}

function getSectionName(pathname: string): string {
  if (pathname.startsWith('/admin/announcements')) return 'Announcements'
  if (pathname.startsWith('/admin/requests')) return 'Website requests'
  if (pathname.startsWith('/admin/subscribers')) return 'Subscribers'
  if (pathname.startsWith('/admin/families')) return 'Families'
  if (pathname.startsWith('/admin/payments')) return 'Payments'
  if (pathname.startsWith('/admin/settings')) return 'Settings'
  if (pathname.startsWith('/admin/shares')) return 'Shares'
  if (pathname.startsWith('/admin/logs')) return 'Application logs'
  if (pathname.startsWith('/admin/health')) return 'System status'
  if (pathname.startsWith('/admin/users')) return 'Users'
  if (pathname.startsWith('/admin/events')) return 'Events'
  return 'Dashboard'
}
