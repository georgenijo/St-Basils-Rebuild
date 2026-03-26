'use client'

import { cn } from '@/lib/utils'

const DAYS = [
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
  { value: 'SU', label: 'Sun' },
] as const

const FREQUENCIES = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
] as const

interface RRuleBuilderProps {
  frequency: string
  byDay: string[]
  until: string
  count: string
  onFrequencyChange: (value: string) => void
  onByDayChange: (days: string[]) => void
  onUntilChange: (value: string) => void
  onCountChange: (value: string) => void
  errors?: Record<string, string[]>
}

const inputBase =
  'w-full rounded-lg border bg-cream-50 px-4 py-3 font-body text-base text-wood-800 placeholder:text-wood-800/40 transition-colors focus:border-burgundy-700 focus:outline-none focus:ring-2 focus:ring-burgundy-700/20'

export function RRuleBuilder({
  frequency,
  byDay,
  until,
  count,
  onFrequencyChange,
  onByDayChange,
  onUntilChange,
  onCountChange,
  errors,
}: RRuleBuilderProps) {
  function toggleDay(day: string) {
    if (byDay.includes(day)) {
      onByDayChange(byDay.filter((d) => d !== day))
    } else {
      onByDayChange([...byDay, day])
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-wood-800/10 bg-cream-100/50 p-4">
      <p className="text-sm font-medium text-wood-900">Recurrence Pattern</p>

      {/* Frequency */}
      <div>
        <label
          htmlFor="rrule_frequency"
          className="mb-1.5 block font-body text-sm font-medium text-wood-900"
        >
          Frequency <span className="text-burgundy-700">*</span>
        </label>
        <select
          id="rrule_frequency"
          name="rrule_frequency"
          value={frequency}
          onChange={(e) => onFrequencyChange(e.target.value)}
          className={cn(inputBase, errors?.rrule_frequency && 'border-red-400')}
        >
          <option value="">Select frequency</option>
          {FREQUENCIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        {errors?.rrule_frequency && (
          <p className="mt-1.5 font-body text-sm text-red-600" role="alert">
            {errors.rrule_frequency[0]}
          </p>
        )}
      </div>

      {/* Day picker — only show for WEEKLY */}
      {frequency === 'WEEKLY' && (
        <div>
          <p className="mb-1.5 font-body text-sm font-medium text-wood-900">Repeat on</p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  byDay.includes(day.value)
                    ? 'bg-burgundy-700 text-cream-50'
                    : 'border border-wood-800/20 bg-cream-50 text-wood-800 hover:bg-cream-100'
                )}
              >
                {day.label}
              </button>
            ))}
          </div>
          {/* Hidden input to submit selected days */}
          <input type="hidden" name="rrule_by_day" value={byDay.join(',')} />
        </div>
      )}

      {/* End condition */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="rrule_until"
            className="mb-1.5 block font-body text-sm font-medium text-wood-900"
          >
            End date
          </label>
          <input
            type="date"
            id="rrule_until"
            name="rrule_until"
            value={until}
            onChange={(e) => {
              onUntilChange(e.target.value)
              if (e.target.value) onCountChange('')
            }}
            className={inputBase}
          />
        </div>
        <div>
          <label
            htmlFor="rrule_count"
            className="mb-1.5 block font-body text-sm font-medium text-wood-900"
          >
            Or after # occurrences
          </label>
          <input
            type="number"
            id="rrule_count"
            name="rrule_count"
            min={1}
            value={count}
            onChange={(e) => {
              onCountChange(e.target.value)
              if (e.target.value) onUntilChange('')
            }}
            placeholder="e.g. 10"
            className={inputBase}
          />
        </div>
      </div>
    </div>
  )
}
