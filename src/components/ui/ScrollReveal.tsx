'use client'

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

import { cn } from '@/lib/utils'

type Direction = 'up' | 'down' | 'left' | 'right'

export interface ScrollRevealProps {
  children: React.ReactNode
  direction?: Direction
  delay?: number
  stagger?: number
  className?: string
  as?: React.ElementType
}

const offsets: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 40 },
  down: { x: 0, y: -40 },
  left: { x: 40, y: 0 },
  right: { x: -40, y: 0 },
}

export function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  className,
  as: Tag = 'div',
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const prefersReducedMotion = useReducedMotion()

  const Component = motion.create(Tag as React.ElementType)
  const offset = offsets[direction]

  return (
    <Component
      ref={ref}
      initial={
        prefersReducedMotion
          ? { opacity: 1 }
          : { opacity: 0, x: offset.x, y: offset.y }
      }
      animate={
        isInView
          ? { opacity: 1, x: 0, y: 0 }
          : prefersReducedMotion
            ? { opacity: 1 }
            : { opacity: 0, x: offset.x, y: offset.y }
      }
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : {
              type: 'spring',
              stiffness: 200,
              damping: 20,
              delay,
            }
      }
      className={cn(className)}
    >
      {children}
    </Component>
  )
}
