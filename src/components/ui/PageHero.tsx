'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'

import { cn } from '@/lib/utils'

export interface PageHeroProps {
  title: string
  backgroundImage: string
  className?: string
}

export function PageHero({ title, backgroundImage, className }: PageHeroProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section
      className={cn('relative flex h-[40vh] items-center justify-center overflow-hidden md:h-[60vh]', className)}
    >
      <Image
        src={backgroundImage}
        alt=""
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-black/50" />
      <motion.h1
        className="relative z-10 px-4 text-center font-heading text-[2.5rem] font-light leading-[1.1] text-cream-50 md:text-[4rem]"
        initial={prefersReducedMotion ? false : { opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        {title}
      </motion.h1>
    </section>
  )
}
