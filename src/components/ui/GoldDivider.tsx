import { cn } from '@/lib/utils'

interface GoldDividerProps {
  className?: string
}

export function GoldDivider({ className }: GoldDividerProps) {
  return (
    <div
      role="separator"
      className={cn(
        'mx-auto h-[2px] max-w-[200px] bg-linear-to-r from-transparent via-gold-500 to-transparent',
        className,
      )}
    />
  )
}
