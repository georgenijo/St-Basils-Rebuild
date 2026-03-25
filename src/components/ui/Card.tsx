import { cn } from '@/lib/utils'

const variants = {
  default: 'bg-sand text-wood-800',
  dark: 'bg-charcoal text-cream-50',
  outlined: 'bg-cream-50 text-wood-800 border border-wood-800/10',
} as const

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variants
  children: React.ReactNode
  className?: string
}

export interface CardSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

type CardComponent = React.FC<CardProps> & {
  Header: React.FC<CardSectionProps>
  Body: React.FC<CardSectionProps>
  Footer: React.FC<CardSectionProps>
}

const Card: CardComponent = Object.assign(
  function Card({ variant = 'default', className, children, ...props }: CardProps) {
    return (
      <div
        className={cn('rounded-2xl shadow-sm', variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    )
  },
  {
    Header: function CardHeader({ className, children, ...props }: CardSectionProps) {
      return (
        <div className={cn('p-6 pb-0', className)} {...props}>
          {children}
        </div>
      )
    },
    Body: function CardBody({ className, children, ...props }: CardSectionProps) {
      return (
        <div className={cn('p-6', className)} {...props}>
          {children}
        </div>
      )
    },
    Footer: function CardFooter({ className, children, ...props }: CardSectionProps) {
      return (
        <div className={cn('p-6 pt-0', className)} {...props}>
          {children}
        </div>
      )
    },
  }
)

export { Card }
