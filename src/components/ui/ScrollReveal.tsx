'use client'

import { createContext, useContext } from 'react'
import { useReducedMotion, motion } from 'framer-motion'
import type { Variant } from 'framer-motion'

import { cn } from '@/lib/utils'

type Direction = 'up' | 'down' | 'left' | 'right'

export interface ScrollRevealProps {
  children: React.ReactNode
  direction?: Direction
  delay?: number
  once?: boolean
  stagger?: number
  className?: string
  as?: keyof typeof motion
}

export interface ScrollRevealItemProps {
  children: React.ReactNode
  className?: string
}

const offsets: Record<Direction, { x?: number; y?: number }> = {
  up: { y: 40 },
  down: { y: -40 },
  left: { x: 40 },
  right: { x: -40 },
}

const ScrollRevealContext = createContext<{
  direction: Direction
  reducedMotion: boolean
}>({ direction: 'up', reducedMotion: false })

function getVariants(
  direction: Direction,
  reducedMotion: boolean,
): { hidden: Variant; visible: Variant } {
  if (reducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.2 } },
    }
  }

  const offset = offsets[direction]

  return {
    hidden: { opacity: 0, ...offset },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 20,
      },
    },
  }
}

export function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  once = true,
  stagger = 0.12,
  className,
  as = 'div',
}: ScrollRevealProps) {
  const reducedMotion = useReducedMotion() ?? false
  const variants = getVariants(direction, reducedMotion)

  const MotionComponent = motion[as] as typeof motion.div

  return (
    <ScrollRevealContext.Provider value={{ direction, reducedMotion }}>
      <MotionComponent
        initial="hidden"
        whileInView="visible"
        viewport={{ once, margin: '-50px' }}
        variants={variants}
        transition={{
          delay,
          staggerChildren: stagger,
        }}
        className={cn(className)}
      >
        {children}
      </MotionComponent>
    </ScrollRevealContext.Provider>
  )
}

function ScrollRevealItem({ children, className }: ScrollRevealItemProps) {
  const { direction, reducedMotion } = useContext(ScrollRevealContext)
  const variants = getVariants(direction, reducedMotion)

  return (
    <motion.div variants={variants} className={cn(className)}>
      {children}
    </motion.div>
  )
}

ScrollReveal.Item = ScrollRevealItem
