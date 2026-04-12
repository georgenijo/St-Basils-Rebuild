interface CalendarLegendProps {
  variant?: 'admin' | 'public'
}

const ADMIN_ITEMS = [
  { color: '#253341', label: 'Recurring' },
  { color: '#d97706', label: 'Modified' },
  { color: '#dc2626', label: 'Cancelled' },
  { color: '#059669', label: 'One-time' },
]

const PUBLIC_ITEMS = [
  { color: '#d97706', label: 'Modified' },
  { color: '#dc2626', label: 'Cancelled' },
]

export function CalendarLegend({ variant = 'admin' }: CalendarLegendProps) {
  const items = variant === 'admin' ? ADMIN_ITEMS : PUBLIC_ITEMS

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg bg-cream-100/50 px-4 py-2">
      <span className="font-body text-xs font-medium text-wood-800/60">Legend:</span>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          <span className="font-body text-xs text-wood-800/80">{item.label}</span>
        </span>
      ))}
    </div>
  )
}
