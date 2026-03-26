const DAY_NAMES: Record<string, string> = {
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
  SU: 'Sunday',
}

const FREQ_LABELS: Record<string, string> = {
  DAILY: 'day',
  WEEKLY: 'week',
  MONTHLY: 'month',
  YEARLY: 'year',
}

/**
 * Convert an iCalendar RRULE string into a human-readable description.
 * Example: "FREQ=WEEKLY;BYDAY=SU;UNTIL=20261231T000000Z" →
 *          "Every week on Sunday, until December 31, 2026"
 */
export function describeRecurrence(rruleString: string): string {
  const parts = rruleString.split(';')
  const map: Record<string, string> = {}
  for (const part of parts) {
    const [key, value] = part.split('=')
    if (key && value) map[key] = value
  }

  const freq = map.FREQ
  if (!freq) return ''

  const freqLabel = FREQ_LABELS[freq] || freq.toLowerCase()
  let description = `Every ${freqLabel}`

  if (map.BYDAY) {
    const days = map.BYDAY.split(',')
      .map((d) => DAY_NAMES[d] || d)
    description += ` on ${formatList(days)}`
  }

  if (map.UNTIL) {
    const raw = map.UNTIL
    const year = raw.slice(0, 4)
    const month = raw.slice(4, 6)
    const day = raw.slice(6, 8)
    const date = new Date(`${year}-${month}-${day}`)
    description += `, until ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
  } else if (map.COUNT) {
    const count = parseInt(map.COUNT, 10)
    description += `, ${count} time${count !== 1 ? 's' : ''}`
  }

  return description
}

function formatList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}
