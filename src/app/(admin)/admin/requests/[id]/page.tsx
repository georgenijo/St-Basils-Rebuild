import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getDataClient } from '@/lib/supabase/auth'
import {
  UUID_PATTERN,
  formatChangeRequestDateTime,
  loadChangeRequestDetail,
} from '@/lib/change-request-detail'
import { signChangeRequestFiles } from '@/lib/change-request-storage'
import {
  getChangeRequestStatusInfo,
  isActiveChangeRequestStatus,
  isClosableChangeRequestStatus,
  safeExternalUrl,
  sameOriginUrl,
} from '@/lib/change-request-status'
import { ChangeRequestAutoRefresh } from '@/components/features/ChangeRequestAutoRefresh'
import {
  ChangeRequestAttachments,
  ChangeRequestVerification,
} from '@/components/features/ChangeRequestEvidence'
import { ChangeRequestActions } from '@/components/features/ChangeRequestActions'
import { ChangeRequestReplyForm } from '@/components/features/ChangeRequestReplyForm'
import {
  ChangeRequestAttachmentsSkeleton,
  ChangeRequestGallerySkeleton,
  ChangeRequestThreadSkeleton,
  SkeletonBar,
} from '@/components/features/ChangeRequestSkeletons'
import { ChangeRequestStatusBadge } from '@/components/features/ChangeRequestStatusBadge'
import {
  ChangeRequestMessageCount,
  ChangeRequestThread,
} from '@/components/features/ChangeRequestThread'

export const metadata: Metadata = {
  title: 'Website Request',
}

interface PageProps {
  params: Promise<{ id: string }>
}

function BackLink() {
  return (
    <div className="mb-6">
      <Link href="/admin/requests" className="admin-button admin-button-bare">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        Back to Requests
      </Link>
    </div>
  )
}

async function PersonName({ id, names }: { id: string; names: Promise<Map<string, string>> }) {
  return <>{(await names).get(id) ?? 'Unknown admin'}</>
}

export default async function ChangeRequestDetailPage({ params }: PageProps) {
  const { id } = await params
  if (!UUID_PATTERN.test(id)) notFound()

  const supabase = await getDataClient()
  // Every read starts now; only the request row gates the header. The thread,
  // evidence and attachments stream in through Suspense as their data lands.
  const detail = loadChangeRequestDetail(supabase, id, signChangeRequestFiles)
  const request = await detail.request
  if (!request) notFound()

  const statusInfo = getChangeRequestStatusInfo(request.status)
  const active = isActiveChangeRequestStatus(request.status)
  const prUrl = safeExternalUrl(request.pr_url)
  const previewUrl = safeExternalUrl(request.preview_url)
  // Only link to the preview if the page path stays on the preview's origin.
  const previewPageUrl = previewUrl ? sameOriginUrl(request.page_path, previewUrl) : null
  const hasVerification = Boolean(request.verification)

  return (
    <main className="admin-page">
      <BackLink />

      <div className="admin-page-head">
        <div>
          <h1>{request.title}</h1>
          <p className="admin-page-subtitle">
            <Suspense fallback={<SkeletonBar width="96px" />}>
              <PersonName id={request.requester_id} names={detail.names} />
            </Suspense>{' '}
            · {formatChangeRequestDateTime(request.created_at)} · <code>{request.page_path}</code>
          </p>
        </div>
        {active && <ChangeRequestAutoRefresh />}
      </div>

      <section
        className="cr-status-card"
        data-tone={statusInfo.tone}
        aria-label="Request status"
        data-testid="change-request-status"
      >
        <div className="cr-status-row">
          <ChangeRequestStatusBadge status={request.status} />
          {request.attempts > 1 && <span className="admin-meta">Attempt {request.attempts}</span>}
        </div>
        <p className="cr-status-copy">{statusInfo.description}</p>
        {request.error && request.status === 'needs_attention' && (
          <p className="cr-status-error">{request.error}</p>
        )}
        {(prUrl || previewPageUrl) && (
          <div className="cr-links">
            {prUrl && (
              <a
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-button admin-button-quiet"
              >
                Pull request{request.pr_number ? ` #${request.pr_number}` : ''}
              </a>
            )}
            {previewPageUrl && (
              <a
                href={previewPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-button admin-button-quiet"
              >
                Open preview
              </a>
            )}
          </div>
        )}
        <ChangeRequestActions
          requestId={request.id}
          canClose={isClosableChangeRequestStatus(request.status)}
          hasPullRequest={Boolean(request.pr_number || request.branch_name || request.attempts > 0)}
        />
      </section>

      <div className="cr-detail-grid">
        <div>
          <section className="admin-section">
            <div className="admin-section-head">
              <h2>Request</h2>
            </div>
            <p className="cr-prose">{request.description}</p>
            <dl className="cr-dl">
              <dt>Page</dt>
              <dd>
                <code>{request.page_path}</code>
              </dd>
              {request.target_selector && (
                <>
                  <dt>Element</dt>
                  <dd>
                    <code className="cr-picked-selector">{request.target_selector}</code>
                  </dd>
                </>
              )}
              {request.target_text && (
                <>
                  <dt>Element text</dt>
                  <dd>“{request.target_text}”</dd>
                </>
              )}
              {request.branch_name && (
                <>
                  <dt>Branch</dt>
                  <dd>
                    <code>{request.branch_name}</code>
                  </dd>
                </>
              )}
            </dl>
          </section>

          <Suspense
            fallback={
              hasVerification ? (
                <section className="admin-section" aria-label="Verification">
                  <div className="admin-section-head">
                    <h2>Verification</h2>
                  </div>
                  <ChangeRequestGallerySkeleton />
                </section>
              ) : null
            }
          >
            <ChangeRequestVerification request={request} files={detail.files} />
          </Suspense>

          <section className="admin-section" aria-label="Conversation">
            <div className="admin-section-head">
              <h2>Conversation</h2>
              <Suspense fallback={null}>
                <ChangeRequestMessageCount messages={detail.messages} />
              </Suspense>
            </div>
            <Suspense fallback={<ChangeRequestThreadSkeleton />}>
              <ChangeRequestThread
                messages={detail.messages}
                names={detail.names}
                context={{
                  prUrl,
                  prNumber: request.pr_number,
                  previewUrl,
                }}
              />
            </Suspense>
            <ChangeRequestReplyForm
              requestId={request.id}
              requeuesOnReply={request.status === 'needs_attention'}
              canRequestChanges={request.status === 'ready_for_review'}
            />
          </section>
        </div>

        <aside>
          <section className="admin-section" aria-label="Attachments">
            <Suspense
              fallback={
                <>
                  <div className="admin-section-head">
                    <h2>Attachments</h2>
                  </div>
                  <ChangeRequestAttachmentsSkeleton />
                </>
              }
            >
              <ChangeRequestAttachments files={detail.files} />
            </Suspense>
          </section>
        </aside>
      </div>
    </main>
  )
}
