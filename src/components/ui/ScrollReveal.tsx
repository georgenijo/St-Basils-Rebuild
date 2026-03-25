'use client'

import { motion, useReducedMotion } from 'framer-motion'

type Direction = 'up' | 'down' | 'left' | 'right'

export interface ScrollRevealProps {
  children: React.ReactNode
  direction?: Direction
  delay?: number
  once?: boolean
  stagger?: number
  className?: string
}

const offsets: Record<Direction, { x?: number; y?: number }> = {
  up: { y: 40 },
  down: { y: -40 },
  left: { x: 40 },
  right: { x: -40 },
}

export function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  once = true,
  stagger = 0.12,
  className,
}: ScrollRevealProps) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  const offset = offsets[direction]

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 20,
        delay,
        staggerChildren: stagger,
      }}
    >
      {children}
    </motion.div>
  )
}
