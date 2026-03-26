import type { DateArray } from 'ics'

export const CHURCH_TIME_ZONE = 'America/New_York'

const LOCALE = 'en-US'
const DATETIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
const RRULE_UTC_PATTERN =
  /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/

interface DateTimeParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function getFormatter(
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    ...options,
  })
}

function getDateTimeParts(date: Date, timeZone: string): DateTimeParts {
  const formatter = getFormatter(timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(date)
  const values = Object.fromEntries(
    parts
      .filter((part) =>
        ['year', 'month', 'day', 'hour', 'minute', 'second'].includes(part.type)
      )
      .map((part) => [part.type, Number(part.value)])
  ) as Record<keyof DateTimeParts, number>

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  }
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = getFormatter(timeZone, {
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  })

  const timeZoneName =
    formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')
      ?.value ?? 'GMT'

  const match = timeZoneName.match(/^GMT(?:(\+|-)(\d{1,2})(?::?(\d{2}))?)?$/)
  if (match) {
    const sign = match[1] === '-' ? -1 : 1
    const hours = Number(match[2] ?? 0)
    const minutes = Number(match[3] ?? 0)
    return sign * (hours * 60 + minutes)
  }

  const parts = getDateTimeParts(date, timeZone)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )

  return Math.round((asUtc - date.getTime()) / 60000)
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

function parseDatetimeLocal(value: string) {
  const match = value.match(DATETIME_LOCAL_PATTERN)
  if (!match) {
    return null
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  }
}

export function formatInChurchTimeZone(
  isoString: string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: CHURCH_TIME_ZONE,
    ...options,
  }).format(new Date(isoString))
}

export function getChurchTimeZoneName(isoString: string): string {
  return (
    new Intl.DateTimeFormat(LOCALE, {
      timeZone: CHURCH_TIME_ZONE,
      timeZoneName: 'short',
      hour: 'numeric',
    })
      .formatToParts(new Date(isoString))
      .find((part) => part.type === 'timeZoneName')?.value ?? 'ET'
  )
}

export function formatIsoForDatetimeLocal(
  isoString: string | null | undefined,
  timeZone = CHURCH_TIME_ZONE
): string {
  if (!isoString) {
    return ''
  }

  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const parts = getDateTimeParts(date, timeZone)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}

// Convert a wall-clock datetime entered in the church timezone into UTC for storage.
export function parseDatetimeLocalInTimeZone(
  value: string,
  timeZone = CHURCH_TIME_ZONE
): string | null {
  const parsed = parseDatetimeLocal(value)
  if (!parsed) {
    return null
  }

  const wallClockUtc = Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute
  )

  let utcMillis = wallClockUtc
  for (let index = 0; index < 3; index += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(new Date(utcMillis), timeZone)
    const nextUtcMillis = wallClockUtc - offsetMinutes * 60_000

    if (nextUtcMillis === utcMillis) {
      break
    }

    utcMillis = nextUtcMillis
  }

  const isoString = new Date(utcMillis).toISOString()

  return formatIsoForDatetimeLocal(isoString, timeZone) === value
    ? isoString
    : null
}

export function toUtcDateArray(isoString: string): DateArray {
  const date = new Date(isoString)
  return [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
  ]
}

export function toTimeZoneDateArray(
  isoString: string,
  timeZone = CHURCH_TIME_ZONE
): DateArray {
  const parts = getDateTimeParts(new Date(isoString), timeZone)
  return [parts.year, parts.month, parts.day, parts.hour, parts.minute]
}

export function toRRuleUtcTimestamp(isoString: string): string {
  return new Date(isoString)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

export function buildRecurrenceUntilTimestamp(
  untilDate: string,
  startsAtLocal: string,
  timeZone = CHURCH_TIME_ZONE
): string | null {
  const isoString = buildRecurrenceUntilIso(untilDate, startsAtLocal, timeZone)
  return isoString ? toRRuleUtcTimestamp(isoString) : null
}

export function buildRecurrenceUntilIso(
  untilDate: string,
  startsAtLocal: string,
  timeZone = CHURCH_TIME_ZONE
): string | null {
  const parsedStart = parseDatetimeLocal(startsAtLocal)
  if (!parsedStart) {
    return null
  }

  return parseDatetimeLocalInTimeZone(
    `${untilDate}T${pad(parsedStart.hour)}:${pad(parsedStart.minute)}`,
    timeZone
  )
}

export function parseRRuleUntilToDateInput(
  rawUntil: string,
  timeZone = CHURCH_TIME_ZONE
): string {
  const utcMatch = rawUntil.match(RRULE_UTC_PATTERN)
  if (utcMatch) {
    const isoString = `${utcMatch[1]}-${utcMatch[2]}-${utcMatch[3]}T${utcMatch[4]}:${utcMatch[5]}:${utcMatch[6]}Z`
    const parts = getDateTimeParts(new Date(isoString), timeZone)
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
  }

  return `${rawUntil.slice(0, 4)}-${rawUntil.slice(4, 6)}-${rawUntil.slice(6, 8)}`
}
