'use client'

import { cn } from '@/lib/utils'
import { logout } from '@/actions/auth'

// ─── Component ───────────────────────────────────────────────────────

export interface MemberTopBarProps {
  email: string
  className?: string
}

export function MemberTopBar({ email, className }: MemberTopBarProps) {
  return (
    <header
      className={cn(
        'flex h-16 items-center justify-between border-b border-wood-800/10 bg-cream-50 px-4 sm:px-6 lg:px-8',
        className
      )}
    >
      {/* Left spacer for mobile hamburger */}
      <div className="w-11 lg:hidden" aria-hidden="true" />

      {/* Page context — empty for now, can be used for breadcrumbs later */}
      <div className="hidden lg:block" />

      {/* User info + logout */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-wood-800/60">{email}</span>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-lg px-4 py-2 text-sm font-medium text-burgundy-700 transition-colors hover:bg-burgundy-100"
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  )
}
