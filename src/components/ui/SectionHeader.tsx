import { cn } from '@/lib/utils'

import { GoldDivider } from '@/components/ui/GoldDivider'

type HeadingLevel = 'h1' | 'h2' | 'h3'
type Alignment = 'left' | 'center'

export interface SectionHeaderProps {
  title: string
  subtitle?: string
  align?: Alignment
  as?: HeadingLevel
  className?: string
}

const headingSizes: Record<HeadingLevel, string> = {
  h1: 'text-[2rem] md:text-[3rem] leading-[1.2] font-semibold',
  h2: 'text-[1.75rem] md:text-[2.25rem] leading-[1.3] font-semibold',
  h3: 'text-[1.25rem] md:text-[1.5rem] leading-[1.4] font-semibold',
}

export function SectionHeader({
  title,
  subtitle,
  align = 'center',
  as: Tag = 'h2',
  className,
}: SectionHeaderProps) {
  const isCenter = align === 'center'

  return (
    <div className={cn(isCenter ? 'text-center' : 'text-left', className)}>
      <Tag className={cn(headingSizes[Tag], 'text-wood-900')}>{title}</Tag>

      <GoldDivider className={cn('my-4', !isCenter && 'mx-0')} />

      {subtitle && (
        <p className="font-body text-base leading-relaxed text-wood-800/60">{subtitle}</p>
      )}
    </div>
  )
}
