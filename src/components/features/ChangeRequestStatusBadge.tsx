import { getChangeRequestStatusInfo, type StatusTone } from '@/lib/change-request-status'
import { cn } from '@/lib/utils'

export function toneClass(tone: StatusTone): string | undefined {
  if (tone === 'ok') return 'admin-status-ok'
  if (tone === 'warn') return 'admin-status-warn'
  return undefined
}

export function ChangeRequestStatusBadge({ status }: { status: string }) {
  const info = getChangeRequestStatusInfo(status)
  return (
    <span className={cn('admin-status', toneClass(info.tone))} data-status={status}>
      {info.label}
    </span>
  )
}
