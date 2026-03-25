import { cn } from '@/lib/utils'

import { GoldDivider } from '@/components/ui/GoldDivider'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  align?: 'left' | 'center'
  as?: 'h1' | 'h2' | 'h3'
  className?: string
}

const headingStyles = {
  h1: 'text-[2rem] md:text-[3rem] font-semibold leading-[1.2]',
  h2: 'text-[1.75rem] md:text-[2.25rem] font-semibold leading-[1.3]',
  h3: 'text-[1.25rem] md:text-[1.5rem] font-semibold leading-[1.4]',
} as const

export function SectionHeader({
  title,
  subtitle,
  align = 'center',
  as: Tag = 'h2',
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'mb-12',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      <Tag className={cn('font-heading text-wood-900', headingStyles[Tag])}>
        {title}
      </Tag>
      <GoldDivider className={cn('my-4', align === 'left' && 'mx-0')} />
      {subtitle && (
        <p className="font-body text-base leading-relaxed text-wood-800/60">
          {subtitle}
        </p>
      )}
    </div>
  )
}
