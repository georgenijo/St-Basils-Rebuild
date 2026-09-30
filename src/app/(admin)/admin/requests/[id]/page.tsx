import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { fetchPeopleNames } from '@/lib/change-request-people'
import { signChangeRequestFiles } from '@/lib/change-request-storage'
import {
  VERDICT_INFO,
  getChangeRequestStatusInfo,
  isActiveChangeRequestStatus,
  normalizeVerificationChecks,
  safeExternalUrl,
  sameOriginUrl,
  shortCommitSha,
} from '@/lib/change-request-status'
import { formatBytes } from '@/lib/validators/change-request'
import { cn } from '@/lib/utils'
import { ChangeRequestAutoRefresh } from '@/components/features/ChangeRequestAutoRefresh'
import { ChangeRequestReplyForm } from '@/components/features/ChangeRequestReplyForm'
import { ChangeRequestStatusBadge, toneClass } from '@/components/features/ChangeRequestStatusBadge'
import type {
  ChangeRequest,
  ChangeRequestFile,
  ChangeRequestFileWithUrl,
  ChangeRequestMessage,
  ChangeRequestVerdict,
} from '@/types/change-request'

export const metadata: Metadata = {
  title: 'Website Request',
}

interface PageProps {
  params: Promise<{ id: string }>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  })
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

function FileLink({ file }: { file: ChangeRequestFileWithUrl }) {
  if (!file.url) return <span>{file.filename} (unavailable)</span>
  return (
    <a href={file.url} target="_blank" rel="noopener noreferrer" className="cr-file-name">
      {file.filename}
    </a>
  )
}

export default async function ChangeRequestDetailPage({ params }: PageProps) {
  const { id } = await params
  if (!UUID_PATTERN.test(id)) notFound()

  const supabase = await createClient()

  const [{ data: requestData }, { data: messageData }, { data: fileData }] = await Promise.all([
    supabase
      .from('change_requests')
      .select(
        'id, requester_id, title, description, page_path, target_selector, target_text, status, branch_name, pr_number, pr_url, preview_url, verification, attempts, error, created_at, updated_at'
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('change_request_messages')
      .select('id, request_id, author_kind, author_id, body, created_at')
      .eq('request_id', id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('change_request_files')
      .select(
        'id, request_id, kind, storage_path, filename, content_type, size_bytes, label, created_at'
      )
      .eq('request_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!requestData) notFound()

  const request = requestData as ChangeRequest
  const messages = (messageData ?? []) as ChangeRequestMessage[]
  const files = await signChangeRequestFiles((fileData ?? []) as ChangeRequestFile[])
  const attachments = files.filter((file) => file.kind === 'attachment')
  const verificationFiles = files.filter((file) => file.kind === 'verification')
  // Screenshots and the private preview recording share `kind: 'verification'`
  // (see db.ts's uploadVerificationShot); split by content_type to render each.
  // Signed URLs come from signChangeRequestFiles and this route is admin-only,
  // so the recording is only ever reachable here — never from the public PR.
  const verificationShots = verificationFiles.filter((file) =>
    file.content_type.startsWith('image/')
  )
  const verificationVideos = verificationFiles.filter((file) =>
    file.content_type.startsWith('video/')
  )

  const names = await fetchPeopleNames(supabase, [
    request.requester_id,
    ...messages.map((message) => message.author_id),
  ])

  const statusInfo = getChangeRequestStatusInfo(request.status)
  const active = isActiveChangeRequestStatus(request.status)
  const prUrl = safeExternalUrl(request.pr_url)
  const previewUrl = safeExternalUrl(request.preview_url)
  // Only link to the preview if the page path stays on the preview's origin.
  const previewPageUrl = previewUrl ? sameOriginUrl(request.page_path, previewUrl) : null
  // Null after a requeue (the claim clears it); tolerate malformed values.
  const verification =
    request.verification &&
    typeof request.verification === 'object' &&
    !Array.isArray(request.verification)
      ? request.verification
      : null
  const verdict =
    verification && typeof verification.verdict === 'string' && verification.verdict in VERDICT_INFO
      ? VERDICT_INFO[verification.verdict as ChangeRequestVerdict]
      : null
  const commitSha = shortCommitSha(verification?.commit_sha)
  const summary = typeof verification?.summary === 'string' ? verification.summary : null
  const checks = normalizeVerificationChecks(verification?.checks)

  return (
    <main className="admin-page">
      <BackLink />

      <div className="admin-page-head">
        <div>
          <h1>{request.title}</h1>
          <p className="admin-page-subtitle">
            {names.get(request.requester_id) ?? 'Unknown admin'} ·{' '}
            {formatDateTime(request.created_at)} · <code>{request.page_path}</code>
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

          {(verification || verificationShots.length > 0 || verificationVideos.length > 0) && (
            <section className="admin-section" aria-label="Verification">
              <div className="admin-section-head">
                <h2>Verification</h2>
                <div className="cr-status-row">
                  {commitSha && (
                    <code className="admin-meta" title="Verified commit">
                      {commitSha}
                    </code>
                  )}
                  {verdict && (
                    <span
                      className={cn('admin-status', toneClass(verdict.tone))}
                      data-testid="verification-verdict"
                    >
                      {verdict.label}
                    </span>
                  )}
                </div>
              </div>
              {!verification && (
                <p className="cr-help" style={{ marginTop: 12 }}>
                  Screenshots below are from a previous attempt.
                </p>
              )}
              {summary && <p className="cr-prose">{summary}</p>}
              {checks.length > 0 && (
                <ul className="cr-checks">
                  {checks.map((check, index) => (
                    <li key={`${check.name}-${index}`}>
                      <span
                        className={cn(
                          'admin-status',
                          check.outcome === 'pass' && 'admin-status-ok',
                          check.outcome === 'fail' && 'admin-status-warn'
                        )}
                      >
                        {check.name}
                      </span>
                      {check.detail && <span className="cr-check-detail">{check.detail}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {verificationShots.length > 0 && (
                <ul className="cr-shots">
                  {verificationShots.map((shot) => (
                    <li key={shot.id}>
                      <figure className="cr-shot">
                        {shot.url ? (
                          <a href={shot.url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={shot.url} alt={shot.label ?? shot.filename} loading="lazy" />
                          </a>
                        ) : (
                          <div className="cr-file-thumb">Unavailable</div>
                        )}
                        <figcaption>{shot.label ?? shot.filename}</figcaption>
                      </figure>
                    </li>
                  ))}
                </ul>
              )}
              {verificationVideos.length > 0 && (
                <ul className="cr-shots" aria-label="Preview recordings (admin-only)">
                  {verificationVideos.map((video) => (
                    <li key={video.id}>
                      <figure className="cr-shot">
                        {video.url ? (
                          // eslint-disable-next-line jsx-a11y/media-has-caption -- private admin evidence, no spoken audio track
                          <video src={video.url} controls preload="metadata" />
                        ) : (
                          <div className="cr-file-thumb">Unavailable</div>
                        )}
                        <figcaption>{video.label ?? video.filename}</figcaption>
                      </figure>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="admin-section" aria-label="Conversation">
            <div className="admin-section-head">
              <h2>Conversation</h2>
              <span className="admin-meta">{messages.length}</span>
            </div>
            {messages.length === 0 ? (
              <p className="cr-help" style={{ marginTop: 12 }}>
                No messages yet. The website agent posts progress here as it works.
              </p>
            ) : (
              <ol className="cr-thread">
                {messages.map((message) => (
                  <li key={message.id} className="cr-message" data-kind={message.author_kind}>
                    {message.author_kind !== 'system' && (
                      <div className="cr-message-head">
                        <span className="cr-message-author">
                          {message.author_kind === 'agent'
                            ? 'Website agent'
                            : ((message.author_id && names.get(message.author_id)) ?? 'Admin')}
                        </span>
                        <span className="admin-meta">{formatDateTime(message.created_at)}</span>
                      </div>
                    )}
                    <p className="cr-message-body">{message.body}</p>
                  </li>
                ))}
              </ol>
            )}
            <ChangeRequestReplyForm
              requestId={request.id}
              requeuesOnReply={request.status === 'needs_attention'}
            />
          </section>
        </div>

        <aside>
          <section className="admin-section" aria-label="Attachments">
            <div className="admin-section-head">
              <h2>Attachments</h2>
              <span className="admin-meta">{attachments.length}</span>
            </div>
            {attachments.length === 0 ? (
              <p className="cr-help" style={{ marginTop: 12 }}>
                No attachments.
              </p>
            ) : (
              <ul className="cr-files">
                {attachments.map((file) => (
                  <li key={file.id} className="cr-file">
                    <div className="cr-file-thumb">
                      {file.url && file.content_type.startsWith('image/') ? (
                        <a href={file.url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={file.url} alt={`Preview of ${file.filename}`} loading="lazy" />
                        </a>
                      ) : (
                        <span>{file.content_type === 'application/pdf' ? 'PDF' : 'File'}</span>
                      )}
                    </div>
                    <div className="cr-file-meta">
                      <FileLink file={file} />
                      <span className="cr-file-size">{formatBytes(file.size_bytes)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </main>
  )
}
