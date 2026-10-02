'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────

interface NavChild {
  label: string
  href: string
}

interface NavItem {
  label: string
  href?: string
  children?: NavChild[]
}

// ─── Navigation Data ─────────────────────────────────────────────────

const navigation: NavItem[] = [
  { label: 'Home', href: '/' },
  {
    label: 'About',
    children: [
      { label: 'Our History', href: '/about' },
      { label: 'Our Spiritual Fathers', href: '/spiritual-leaders' },
      { label: 'Our Clergy', href: '/our-clergy' },
      { label: 'Our Office Bearers', href: '/office-bearers' },
      { label: 'Our Acolytes & Choir', href: '/acolytes-choir' },
      { label: 'Our Organizations', href: '/our-organizations' },
    ],
  },
  {
    label: 'Resources',
    children: [
      { label: 'Events Calendar', href: '/events' },
      { label: 'Useful Links', href: '/useful-links' },
      { label: 'First Time Visiting?', href: '/first-time' },
    ],
  },
  { label: 'Giving', href: '/giving' },
  { label: 'Contact Us', href: '/contact' },
]

// ─── Component ───────────────────────────────────────────────────────

export interface NavbarProps {
  className?: string
}

export function Navbar({ className }: NavbarProps) {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const [isClientReady, setIsClientReady] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function openDropdown(label: string) {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setActiveDropdown(label)
  }

  function scheduleCloseDropdown() {
    closeTimerRef.current = setTimeout(() => {
      setActiveDropdown(null)
      closeTimerRef.current = null
    }, 150)
  }

  useEffect(() => {
    setIsClientReady(true)
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  // Close everything on route change
  useEffect(() => {
    setMobileOpen(false)
    setActiveDropdown(null)
    setActiveAccordion(null)
  }, [pathname])

  // Escape key closes dropdowns, then mobile menu.
  // NAV-1: Tab/ShiftTab trapped within the nav while mobile menu is open.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (activeDropdown) {
          setActiveDropdown(null)
        } else if (mobileOpen) {
          setMobileOpen(false)
          hamburgerRef.current?.focus()
        }
        return
      }

      if (e.key === 'Tab' && mobileOpen) {
        // Collect focusable elements visible in the mobile context.
        // Logo and hamburger are in the top-bar; mobile menu items are in #mobile-menu.
        // Collapsed accordion links have tabIndex=-1 (NAV-2) and are excluded by the selector.
        const nav = navRef.current
        if (!nav) return

        const logoLink = nav.querySelector<HTMLElement>('a[aria-label]')
        const mobileItems = Array.from(
          document.querySelectorAll<HTMLElement>(
            '#mobile-menu a[href]:not([tabindex="-1"]), #mobile-menu button:not([disabled]):not([tabindex="-1"])'
          )
        )
        const focusable: HTMLElement[] = [
          ...(logoLink ? [logoLink] : []),
          ...(hamburgerRef.current ? [hamburgerRef.current] : []),
          ...mobileItems,
        ]
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [activeDropdown, mobileOpen])

  // Click outside closes desktop dropdowns
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  // NAV-3: Close mobile menu when viewport crosses the lg breakpoint (1024 px).
  // Without this, body overflow:hidden persists when CSS hides the menu via lg:hidden.
  useEffect(() => {
    if (!mobileOpen) return
    function onResize() {
      if (window.innerWidth >= 1024) {
        setMobileOpen(false)
        setActiveAccordion(null)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mobileOpen])

  const isActive = useCallback(
    (item: NavItem) => {
      if (item.href) return pathname === item.href
      return item.children?.some((child) => pathname === child.href) ?? false
    },
    [pathname]
  )

  const isChildActive = useCallback((href: string) => pathname === href, [pathname])

  return (
    <>
      {/* Backdrop overlay for mobile menu */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <nav
        ref={navRef}
        className={cn('fixed inset-x-0 top-0 z-50 bg-cream-50 shadow-sm', className)}
        aria-label="Main navigation"
      >
        {/* ── Top bar ── */}
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0" aria-label="St. Basil's — Home">
              <Image
                src="/logo.png"
                alt="St. Basil's Syriac Orthodox Church"
                width={207}
                height={40}
                className="h-10 w-auto"
                priority
              />
            </Link>

            {/* ── Desktop links ── */}
            <ul className="hidden lg:flex lg:items-center lg:gap-0.5 xl:gap-1">
              {navigation.map((item) =>
                item.children ? (
                  <li
                    key={item.label}
                    className="relative"
                    onMouseEnter={() => openDropdown(item.label)}
                    onMouseLeave={scheduleCloseDropdown}
                  >
                    <button
                      type="button"
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                        isActive(item)
                          ? 'text-burgundy-700'
                          : 'text-wood-800 hover:text-burgundy-700'
                      )}
                      aria-expanded={activeDropdown === item.label}
                      aria-controls={`dropdown-${item.label}`}
                      onClick={() =>
                        setActiveDropdown(activeDropdown === item.label ? null : item.label)
                      }
                    >
                      {item.label}
                      <ChevronDown
                        className={cn(
                          'transition-transform duration-200',
                          activeDropdown === item.label && 'rotate-180'
                        )}
                      />
                    </button>

                    {/* Dropdown panel */}
                    <ul
                      id={`dropdown-${item.label}`}
                      className={cn(
                        'absolute left-0 top-full mt-1 w-56 origin-top rounded-xl bg-cream-50 py-2 shadow-md transition-all duration-200 motion-reduce:transition-none',
                        activeDropdown === item.label
                          ? 'translate-y-0 scale-100 opacity-100'
                          : 'pointer-events-none -translate-y-2 scale-95 opacity-0'
                      )}
                    >
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn(
                              'block px-4 py-2.5 text-sm transition-colors',
                              isChildActive(child.href)
                                ? 'bg-burgundy-100 text-burgundy-700'
                                : 'text-wood-800 hover:bg-cream-100 hover:text-burgundy-700'
                            )}
                            {...(isChildActive(child.href) && {
                              'aria-current': 'page' as const,
                            })}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ) : (
                  <li key={item.label}>
                    <Link
                      href={item.href!}
                      className={cn(
                        'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                        isActive(item)
                          ? 'text-burgundy-700'
                          : 'text-wood-800 hover:text-burgundy-700'
                      )}
                      {...(isActive(item) && {
                        'aria-current': 'page' as const,
                      })}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              )}
            </ul>

            {/* ── Desktop login link ── */}
            <Link
              href="/login"
              className="hidden lg:inline-flex items-center rounded-lg border border-burgundy-700 px-4 py-1.5 text-sm font-medium text-burgundy-700 transition-colors hover:bg-burgundy-700 hover:text-white"
            >
              Login
            </Link>

            {/* ── Hamburger button ── */}
            {isClientReady ? (
              <button
                ref={hamburgerRef}
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-wood-800 transition-colors hover:text-burgundy-700 lg:hidden"
                onClick={(event) => {
                  event.stopPropagation()
                  setMobileOpen((open) => !open)
                }}
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileOpen ? <CloseIcon /> : <HamburgerIcon />}
              </button>
            ) : (
              <div className="h-11 w-11 lg:hidden" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Gold accent line */}
        <div
          className="h-px bg-gradient-to-r from-transparent via-gold-500 to-transparent"
          aria-hidden="true"
        />

        {/* ── Mobile menu ── */}
        <div
          id="mobile-menu"
          hidden={!mobileOpen}
          aria-hidden={!mobileOpen}
          className="relative z-10 overflow-hidden bg-cream-50 lg:hidden"
        >
          <ul className="max-h-[calc(100vh-5rem)] space-y-1 overflow-y-auto px-4 py-4">
            {navigation.map((item) =>
              item.children ? (
                <li key={item.label}>
                  <button
                    id={`accordion-btn-${item.label}`}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg min-h-[44px] px-4 py-3 text-base font-medium transition-colors',
                      isActive(item) ? 'text-burgundy-700' : 'text-wood-800'
                    )}
                    aria-expanded={activeAccordion === item.label}
                    aria-controls={`accordion-${item.label}`}
                    onClick={() =>
                      setActiveAccordion(activeAccordion === item.label ? null : item.label)
                    }
                  >
                    {item.label}
                    <ChevronDown
                      className={cn(
                        'transition-transform duration-200',
                        activeAccordion === item.label && 'rotate-180'
                      )}
                    />
                  </button>

                  {/* Accordion panel — NAV-2: hidden from AT and tab-order when collapsed */}
                  <ul
                    id={`accordion-${item.label}`}
                    aria-labelledby={`accordion-btn-${item.label}`}
                    aria-hidden={activeAccordion !== item.label}
                    className={cn(
                      'overflow-hidden transition-all duration-200',
                      activeAccordion === item.label ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    )}
                  >
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          tabIndex={activeAccordion === item.label ? undefined : -1}
                          className={cn(
                            'flex items-center rounded-lg min-h-[44px] py-2.5 pl-8 pr-4 text-sm transition-colors',
                            isChildActive(child.href)
                              ? 'bg-burgundy-100 text-burgundy-700'
                              : 'text-wood-800 hover:text-burgundy-700'
                          )}
                          {...(isChildActive(child.href) && {
                            'aria-current': 'page' as const,
                          })}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                <li key={item.label}>
                  <Link
                    href={item.href!}
                    className={cn(
                      'flex items-center rounded-lg min-h-[44px] px-4 py-3 text-base font-medium transition-colors',
                      isActive(item)
                        ? 'bg-burgundy-100 text-burgundy-700'
                        : 'text-wood-800 hover:text-burgundy-700'
                    )}
                    {...(isActive(item) && {
                      'aria-current': 'page' as const,
                    })}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            )}
            {/* ── Mobile login link ── */}
            <li>
              <Link
                href="/login"
                className="flex items-center justify-center rounded-lg min-h-[44px] mx-4 mt-2 border border-burgundy-700 px-4 py-3 text-base font-medium text-burgundy-700 transition-colors hover:bg-burgundy-700 hover:text-white"
              >
                Login
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────

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

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
