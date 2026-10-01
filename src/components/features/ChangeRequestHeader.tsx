import type { ReactNode } from 'react'

import { formatChangeRequestDateTime } from '@/lib/change-request-detail'
import { getChangeRequestStatusInfo } from '@/lib/change-request-status'
import { ChangeRequestStatusBadge } from '@/components/features/ChangeRequestStatusBadge'
import type { ChangeRequest } from '@/types/change-request'

function ExternalButton({
  href,
  primary,
  children,
}: {
  href: string
  primary?: boolean
  children: ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`admin-button ${primary ? 'admin-button-primary' : 'admin-button-quiet'}`}
    >
      {children}
      <span aria-hidden="true">↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

/**
 * Top of a website request: a sticky card with the title, status and
 * one-click PR / preview / evidence links, then the status explanation
 * (requester, date, page, error) which scrolls normally.
 *
 * Extension points for later work on this page:
 * - `actions`: compact one-click buttons (e.g. merge). Rendered after the
 *   PR / preview buttons in the sticky `data-slot="actions"` group.
 * - `statusActions`: controls that expand (e.g. close with a reason). Rendered
 *   at the end of the status block below, which scrolls normally.
 * - `liveStatus`: a live/refresh indicator, rendered beside the status badge.
 */
export function ChangeRequestHeader({
  request,
  requesterName,
  prUrl,
  previewPageUrl,
  liveStatus,
  actions,
  statusActions,
}: {
  request: ChangeRequest
  /** Usually a Suspense-wrapped name, so the header never waits on it. */
  requesterName: ReactNode
  prUrl: string | null
  previewPageUrl: string | null
  liveStatus?: ReactNode
  actions?: ReactNode
  statusActions?: ReactNode
}) {
  const statusInfo = getChangeRequestStatusInfo(request.status)

  return (
    <>
      <header
        className="cr-header"
        aria-label="Request summary"
        data-testid="change-request-header"
      >
        <div className="cr-header-heading">
          <h1>{request.title}</h1>
          <div className="cr-status-row" data-testid="change-request-status">
            <ChangeRequestStatusBadge status={request.status} />
            {request.attempts > 1 && <span className="admin-meta">Attempt {request.attempts}</span>}
            {liveStatus}
          </div>
        </div>
        <div className="cr-header-actions" data-slot="actions">
          {prUrl && (
            <ExternalButton href={prUrl} primary>
              View PR{request.pr_number ? ` #${request.pr_number}` : ''}
            </ExternalButton>
          )}
          {previewPageUrl && <ExternalButton href={previewPageUrl}>Open preview</ExternalButton>}
          <a href="#evidence" className="admin-button admin-button-quiet">
            Evidence
          </a>
          {actions}
        </div>
      </header>

      <section className="cr-status-card" data-tone={statusInfo.tone} aria-label="Request status">
        <p className="admin-page-subtitle">
          {requesterName} · {formatChangeRequestDateTime(request.created_at)} ·{' '}
          <code>{request.page_path}</code>
        </p>
        <p className="cr-status-copy">{statusInfo.description}</p>
        {request.error && request.status === 'needs_attention' && (
          <p className="cr-status-error">{request.error}</p>
        )}
        {statusActions}
      </section>
    </>
  )
}
