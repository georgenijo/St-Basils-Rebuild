'use client'

import { useReducedMotion, motion } from 'framer-motion'

import { cn } from '@/lib/utils'

type Direction = 'up' | 'down' | 'left' | 'right'

interface ScrollRevealProps {
  children: React.ReactNode
  direction?: Direction
  delay?: number
  once?: boolean
  stagger?: boolean
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
  stagger = false,
  className,
}: ScrollRevealProps) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  const offset = offsets[direction]

  const containerVariants = {
    hidden: { opacity: 0, ...offset },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 200,
        damping: 20,
        delay,
        ...(stagger && { staggerChildren: 0.12 }),
      },
    },
  }

  const childVariants = stagger
    ? {
        hidden: { opacity: 0, ...offset },
        visible: {
          opacity: 1,
          x: 0,
          y: 0,
          transition: {
            type: 'spring' as const,
            stiffness: 200,
            damping: 20,
          },
        },
      }
    : undefined

  return (
    <motion.div
      className={cn(className)}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once }}
    >
      {stagger
        ? (Array.isArray(children) ? children : [children]).map(
            (child, index) => (
              <motion.div key={index} variants={childVariants}>
                {child}
              </motion.div>
            ),
          )
        : children}
    </motion.div>
  )
}
