import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getDataClient } from '@/lib/supabase/auth'
import {
  UUID_PATTERN,
  findUndoRequestId,
  loadChangeRequestDetail,
} from '@/lib/change-request-detail'
import { isChangeRequestMergeConfigured } from '@/lib/change-request-github'
import { signChangeRequestFiles } from '@/lib/change-request-storage'
import {
  isActiveChangeRequestStatus,
  isAwaitingLiveCheck,
  isClosableChangeRequestStatus,
  safeExternalUrl,
  sameOriginUrl,
} from '@/lib/change-request-status'
import { ChangeRequestAutoRefresh } from '@/components/features/ChangeRequestAutoRefresh'
import {
  ChangeRequestAttachments,
  ChangeRequestVerification,
  EvidenceSection,
} from '@/components/features/ChangeRequestEvidence'
import { ChangeRequestHeader } from '@/components/features/ChangeRequestHeader'
import { ChangeRequestActions } from '@/components/features/ChangeRequestActions'
import { ChangeRequestMergePanel } from '@/components/features/ChangeRequestMergePanel'
import { ChangeRequestReplyForm } from '@/components/features/ChangeRequestReplyForm'
import { ChangeRequestUndo } from '@/components/features/ChangeRequestUndo'
import {
  ChangeRequestAttachmentsSkeleton,
  ChangeRequestGallerySkeleton,
  ChangeRequestThreadSkeleton,
  SkeletonBar,
} from '@/components/features/ChangeRequestSkeletons'
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

  // Keep refreshing until a merged change is confirmed live (or reported).
  const active = isActiveChangeRequestStatus(request.status) || isAwaitingLiveCheck(request)
  const undoable =
    (request.status === 'live' || request.status === 'merged') && Boolean(request.merge_commit_sha)
  const undoRequestId = undoable ? await findUndoRequestId(supabase, request.id) : null
  const prUrl = safeExternalUrl(request.pr_url)
  const previewUrl = safeExternalUrl(request.preview_url)
  // Only link to the preview if the page path stays on the preview's origin.
  const previewPageUrl = previewUrl ? sameOriginUrl(request.page_path, previewUrl) : null

  return (
    <main className="admin-page">
      <BackLink />

      <ChangeRequestHeader
        request={request}
        requesterName={
          <Suspense fallback={<SkeletonBar width="96px" />}>
            <PersonName id={request.requester_id} names={detail.names} />
          </Suspense>
        }
        prUrl={prUrl}
        previewPageUrl={previewPageUrl}
        liveStatus={active ? <ChangeRequestAutoRefresh /> : null}
        statusActions={
          <>
            {request.status === 'ready_for_review' &&
              request.pr_number &&
              isChangeRequestMergeConfigured() && (
                <Suspense fallback={<p className="cr-help">Checking whether it can be merged…</p>}>
                  <ChangeRequestMergePanel
                    requestId={request.id}
                    prNumber={request.pr_number}
                    verifiedSha={request.verification?.commit_sha}
                  />
                </Suspense>
              )}
            <ChangeRequestUndo
              requestId={request.id}
              canUndo={undoable}
              undoRequestId={undoRequestId}
              revertOf={request.revert_of ?? null}
            />
            <ChangeRequestActions
              requestId={request.id}
              canClose={isClosableChangeRequestStatus(request.status)}
              hasPullRequest={Boolean(
                request.pr_number || request.branch_name || request.attempts > 0
              )}
            />
          </>
        }
      />

      <Suspense
        fallback={
          <EvidenceSection>
            <ChangeRequestGallerySkeleton />
          </EvidenceSection>
        }
      >
        <ChangeRequestVerification request={request} files={detail.files} />
      </Suspense>

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
