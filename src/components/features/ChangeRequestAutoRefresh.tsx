'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Re-render the server page every few seconds while the worker is active. */
export function ChangeRequestAutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [router, intervalMs])

  return (
    <span className="cr-live" aria-live="polite">
      Live — updates automatically
    </span>
  )
}
