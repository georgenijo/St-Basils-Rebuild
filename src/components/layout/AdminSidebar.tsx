'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
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
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: <DashboardIcon />,
  },
  {
    label: 'Events',
    href: '/admin/events',
    icon: <CalendarIcon />,
  },
  {
    label: 'Announcements',
    href: '/admin/announcements',
    icon: <MegaphoneIcon />,
  },
  {
    label: 'Subscribers',
    href: '/admin/subscribers',
    icon: <UsersIcon />,
  },
]

// ─── Component ───────────────────────────────────────────────────────

export interface AdminSidebarProps {
  className?: string
}

export function AdminSidebar({ className }: AdminSidebarProps) {
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

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-24 items-center justify-between px-3">
        <span className="px-3 font-heading text-lg font-semibold text-cream-50">Admin</span>
        <Image
          src="/logo.png"
          alt="St. Basil's Syriac Orthodox Church"
          width={80}
          height={80}
          className="h-20 w-20 flex-shrink-0 object-contain"
        />
      </div>

      {/* Gold accent line */}
      <div
        className="mx-4 h-px bg-gradient-to-r from-transparent via-gold-500 to-transparent"
        aria-hidden="true"
      />

      {/* Navigation */}
      <nav className="mt-4 flex-1 px-3" aria-label="Admin navigation">
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

      {/* Back to site link */}
      <div className="px-3 pb-4">
        <div className="mx-1 mb-3 h-px bg-cream-50/10" aria-hidden="true" />
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
        aria-controls="admin-sidebar-mobile"
        aria-label={mobileOpen ? 'Close admin menu' : 'Open admin menu'}
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
        id="admin-sidebar-mobile"
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
        aria-label="Admin sidebar"
      >
        {sidebarContent}
      </aside>
    </>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────

function DashboardIcon() {
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

function CalendarIcon() {
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
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

function MegaphoneIcon() {
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
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function UsersIcon() {
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
