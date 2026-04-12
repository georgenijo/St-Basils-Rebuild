'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

// ─── Navigation Data ─────────────────────────────────────────────────

const navigation: NavItem[] = [
  {
    label: 'Overview',
    href: '/member',
    icon: <OverviewIcon />,
  },
  {
    label: 'Membership',
    href: '/member/membership',
    icon: <MembershipIcon />,
  },
  {
    label: 'Family',
    href: '/member/family',
    icon: <FamilyIcon />,
  },
  {
    label: 'Payments',
    href: '/member/payments',
    icon: <PaymentsIcon />,
  },
  {
    label: 'Shares',
    href: '/member/shares',
    icon: <SharesIcon />,
  },
]

// ─── Component ───────────────────────────────────────────────────────

export interface MemberSidebarProps {
  familyName?: string
  memberSince?: string
  className?: string
}

export function MemberSidebar({ familyName, memberSince, className }: MemberSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  // Escape key closes mobile sidebar
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen])

  const isActive = (href: string) =>
    href === '/member' ? pathname === '/member' : pathname === href || pathname.startsWith(href + '/')

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="flex h-16 items-center px-6">
        <span className="font-heading text-lg font-semibold text-cream-50">My Parish</span>
      </div>

      {/* Gold accent line */}
      <div
        className="mx-4 h-px bg-gradient-to-r from-transparent via-gold-500 to-transparent"
        aria-hidden="true"
      />

      {/* Navigation */}
      <nav className="mt-4 flex-1 px-3" aria-label="Member navigation">
        <ul className="space-y-1">
          {navigation.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-cream-50/10 text-cream-50'
                    : 'text-cream-50/60 hover:bg-cream-50/5 hover:text-cream-50'
                )}
                {...(isActive(item.href) && {
                  'aria-current': 'page' as const,
                })}
              >
                <span className="flex h-5 w-5 items-center justify-center" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom section — family info + back link */}
      <div className="px-3 pb-4">
        <div className="mx-1 mb-3 h-px bg-cream-50/10" aria-hidden="true" />
        {familyName && (
          <div className="mb-3 px-3">
            <div className="text-[13px] text-cream-50/40">{familyName} Family</div>
            {memberSince && (
              <div className="mt-0.5 text-xs text-cream-50/25">Member since {memberSince}</div>
            )}
          </div>
        )}
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-cream-50/60 transition-colors hover:bg-cream-50/5 hover:text-cream-50"
        >
          <span className="flex h-5 w-5 items-center justify-center" aria-hidden="true">
            <ArrowLeftIcon />
          </span>
          Back to site
        </Link>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger — visible only on small screens */}
      <button
        type="button"
        className="fixed left-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-lg bg-charcoal text-cream-50 shadow-md transition-colors hover:bg-charcoal/90 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-expanded={mobileOpen}
        aria-controls="member-sidebar-mobile"
        aria-label={mobileOpen ? 'Close member menu' : 'Open member menu'}
      >
        {mobileOpen ? <CloseIcon /> : <HamburgerIcon />}
      </button>

      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile sidebar */}
      <aside
        id="member-sidebar-mobile"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-charcoal transition-transform duration-300 ease-in-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn('hidden w-64 flex-shrink-0 flex-col bg-charcoal lg:flex', className)}
        aria-label="Member sidebar"
      >
        {sidebarContent}
      </aside>
    </>
  )
}

// ─── Icons ───────────────────────���───────────────────────────────────

function OverviewIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
}

function MembershipIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <path d="M1 10h22" />
      <circle cx="12" cy="15" r="2" />
    </svg>
  )
}

function FamilyIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function PaymentsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

function SharesIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  )
}

function HamburgerIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}
