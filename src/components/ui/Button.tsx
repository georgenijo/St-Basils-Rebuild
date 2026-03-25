import Link from 'next/link'

import { cn } from '@/lib/utils'

const variants = {
  primary: 'bg-burgundy-700 text-cream-50 hover:bg-burgundy-800',
  secondary:
    'border border-burgundy-700 text-burgundy-700 hover:bg-burgundy-700 hover:text-cream-50',
  ghost: 'text-burgundy-700 hover:bg-cream-100',
} as const

const sizes = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
} as const

const base =
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-700 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  href?: string
  children: React.ReactNode
  className?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  href,
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className)

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  )
}
