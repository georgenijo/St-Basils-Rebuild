import { cn } from '@/lib/utils'

type CardVariant = 'default' | 'dark' | 'outlined'

interface CardProps {
  variant?: CardVariant
  children: React.ReactNode
  className?: string
}

interface CardSubProps {
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-sand text-wood-800',
  dark: 'bg-charcoal text-cream-50',
  outlined: 'bg-cream-50 text-wood-800 border border-wood-800/10',
}

function Card({ variant = 'default', children, className }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl shadow-sm',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </div>
  )
}

Card.Header = function CardHeader({ children, className }: CardSubProps) {
  return <div className={cn('p-6 pb-0', className)}>{children}</div>
}

Card.Body = function CardBody({ children, className }: CardSubProps) {
  return <div className={cn('p-6', className)}>{children}</div>
}

Card.Footer = function CardFooter({ children, className }: CardSubProps) {
  return (
    <div className={cn('border-t border-current/10 p-6 pt-4', className)}>
      {children}
    </div>
  )
}

export { Card }
export type { CardProps, CardVariant }
