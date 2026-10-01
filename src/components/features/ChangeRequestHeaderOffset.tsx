'use client'

import { useEffect } from 'react'

/**
 * Publishes the sticky request header's height as `--cr-header-height`, so
 * in-page jumps (the Evidence button) land below it even when extra action
 * buttons make the header wrap.
 */
export function ChangeRequestHeaderOffset({ targetId }: { targetId: string }) {
  useEffect(() => {
    const header = document.getElementById(targetId)
    if (!header) return
    const root = document.documentElement
    const update = () =>
      root.style.setProperty('--cr-header-height', `${Math.ceil(header.offsetHeight)}px`)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(header)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--cr-header-height')
    }
  }, [targetId])

  return null
}
