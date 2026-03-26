import { cn } from '@/lib/utils'

export function CalendarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse', className)}>
      {/* Filter bar skeleton */}
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-lg bg-sand" />
        ))}
      </div>

      {/* Calendar skeleton */}
      <div className="rounded-2xl bg-cream-50 p-4 shadow">
        {/* Header toolbar */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-2">
            <div className="h-9 w-9 rounded bg-sand" />
            <div className="h-9 w-9 rounded bg-sand" />
            <div className="h-9 w-16 rounded bg-sand" />
          </div>
          <div className="h-8 w-48 rounded bg-sand" />
          <div className="hidden gap-1 sm:flex">
            <div className="h-9 w-16 rounded bg-sand" />
            <div className="h-9 w-14 rounded bg-sand" />
            <div className="h-9 w-12 rounded bg-sand" />
          </div>
        </div>

        {/* Day headers */}
        <div className="mb-2 grid grid-cols-7 gap-px">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-sand" />
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-20 rounded bg-sand/50" />
          ))}
        </div>
      </div>
    </div>
  )
}
