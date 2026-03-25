import Image from 'next/image'

import { cn } from '@/lib/utils'

export interface PageHeroProps {
  title: string
  backgroundImage: string
  className?: string
}

export function PageHero({ title, backgroundImage, className }: PageHeroProps) {
  return (
    <section
      className={cn(
        'relative flex h-[40vh] items-center justify-center overflow-hidden md:h-[60vh]',
        className,
      )}
    >
      <Image
        src={backgroundImage}
        alt=""
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <h1 className="relative z-10 max-w-4xl px-4 text-center font-heading text-[2.5rem] font-light leading-[1.1] text-cream-50 opacity-0 animate-drop-in motion-reduce:opacity-100 motion-reduce:animate-none md:text-[4rem]">
        {title}
      </h1>
    </section>
  )
}
