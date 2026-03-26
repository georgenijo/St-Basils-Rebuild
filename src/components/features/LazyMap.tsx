'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

interface LazyMapProps {
  src: string
  title: string
  className?: string
}

export function LazyMap({ src, title, className }: LazyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden rounded-2xl bg-sand', className)}
    >
      {isVisible ? (
        <iframe
          src={src}
          title={title}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
          <p className="text-sm text-wood-800/60">Loading map…</p>
        </div>
      )}
    </div>
  )
}
