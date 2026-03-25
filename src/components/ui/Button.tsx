import Link from 'next/link'

import { cn } from '@/lib/utils'

const variantStyles = {
  primary:
    'bg-burgundy-700 text-cream-50 hover:bg-burgundy-800',
  secondary:
    'border border-burgundy-700 text-burgundy-700 hover:bg-burgundy-700 hover:text-cream-50',
  ghost:
    'text-burgundy-700 hover:bg-cream-100',
} as const

const sizeStyles = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
} as const

interface ButtonProps {
  variant?: keyof typeof variantStyles
  size?: keyof typeof sizeStyles
  href?: string
  disabled?: boolean
  children: React.ReactNode
  className?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  href,
  disabled = false,
  children,
  className,
  ...rest
}: ButtonProps & (
  | (Omit<React.ComponentPropsWithoutRef<'button'>, keyof ButtonProps>)
  | (Omit<React.ComponentPropsWithoutRef<typeof Link>, keyof ButtonProps>)
)) {
  const classes = cn(
    'inline-flex items-center justify-center rounded-lg font-body font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy-700',
    variantStyles[variant],
    sizeStyles[size],
    disabled && 'pointer-events-none opacity-50',
    className,
  )

  if (href && !disabled) {
    return (
      <Link href={href} className={classes} {...(rest as Omit<React.ComponentPropsWithoutRef<typeof Link>, keyof ButtonProps>)}>
        {children}
      </Link>
    )
  }

  return (
    <button type="button" className={classes} disabled={disabled} {...(rest as Omit<React.ComponentPropsWithoutRef<'button'>, keyof ButtonProps>)}>
      {children}
    </button>
  )
}
