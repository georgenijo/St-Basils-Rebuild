import { THUMBNAIL_CONTENT_TYPES, changeRequestThumbnailPath } from '@/lib/change-request-detail'
import { groupEvidenceShots } from '@/lib/change-request-evidence'
import {
  VERDICT_INFO,
  isActiveChangeRequestStatus,
  normalizeVerificationChecks,
  shortCommitSha,
} from '@/lib/change-request-status'
import { formatBytes } from '@/lib/validators/change-request'
import { cn } from '@/lib/utils'
import {
  ChangeRequestEvidenceGallery,
  type GalleryItem,
} from '@/components/features/ChangeRequestEvidenceGallery'
import { toneClass } from '@/components/features/ChangeRequestStatusBadge'
import type {
  ChangeRequest,
  ChangeRequestFileWithUrl,
  ChangeRequestVerdict,
} from '@/types/change-request'

/**
 * Small cached thumbnail linked to the full-size signed URL. Thumbnails come
 * from a stable per-file route, so the page's auto-refresh does not re-download
 * multi-megabyte screenshots every few seconds.
 */
function Thumbnail({ file, alt }: { file: ChangeRequestFileWithUrl; alt: string }) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- private, already-resized thumbnail
    <img src={changeRequestThumbnailPath(file)} alt={alt} loading="lazy" decoding="async" />
  )
  if (!file.url) return image
  return (
    <a href={file.url} target="_blank" rel="noopener noreferrer">
      {image}
    </a>
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

function galleryItem(file: ChangeRequestFileWithUrl): GalleryItem {
  return {
    id: file.id,
    label: file.label ?? file.filename,
    thumbnailSrc: THUMBNAIL_CONTENT_TYPES.has(file.content_type)
      ? changeRequestThumbnailPath(file)
      : null,
    fullSrc: file.url,
  }
}

/** Shared frame for the evidence panel (also used by its loading fallback). */
export function EvidenceSection({
  children,
  meta,
}: {
  children: React.ReactNode
  meta?: React.ReactNode
}) {
  return (
    <section
      id="evidence"
      className="admin-section cr-evidence"
      aria-label="Evidence"
      data-testid="change-request-evidence"
    >
      <div className="admin-section-head">
        <h2>Evidence</h2>
        {meta && <div className="cr-status-row">{meta}</div>}
      </div>
      {children}
    </section>
  )
}

/**
 * Verification verdict, checks, before/after screenshots (with a lightbox)
 * and the private preview recording, all in one panel.
 */
export async function ChangeRequestVerification({
  request,
  files: filesPromise,
}: {
  request: ChangeRequest
  files: Promise<ChangeRequestFileWithUrl[]>
}) {
  const files = await filesPromise
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

  // Null after a requeue (the claim clears it); tolerate malformed values.
  const verification =
    request.verification &&
    typeof request.verification === 'object' &&
    !Array.isArray(request.verification)
      ? request.verification
      : null

  if (!verification && verificationShots.length === 0 && verificationVideos.length === 0) {
    return (
      <EvidenceSection>
        <p className="cr-help cr-evidence-empty" data-testid="change-request-evidence-empty">
          {isActiveChangeRequestStatus(request.status)
            ? 'Screenshots and a recording of the preview appear here once the agent has verified the change.'
            : 'No screenshots or recordings for this request.'}
        </p>
      </EvidenceSection>
    )
  }

  const verdict =
    verification && typeof verification.verdict === 'string' && verification.verdict in VERDICT_INFO
      ? VERDICT_INFO[verification.verdict as ChangeRequestVerdict]
      : null
  const commitSha = shortCommitSha(verification?.commit_sha)
  const summary = typeof verification?.summary === 'string' ? verification.summary : null
  const checks = normalizeVerificationChecks(verification?.checks)
  const groups = groupEvidenceShots(verificationShots)

  return (
    <EvidenceSection
      meta={
        <>
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
        </>
      }
    >
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
        <ChangeRequestEvidenceGallery
          comparisons={groups.comparisons.map((comparison) => ({
            viewport: comparison.viewport,
            before: comparison.before && galleryItem(comparison.before),
            after: comparison.after && galleryItem(comparison.after),
          }))}
          others={groups.others.map(galleryItem)}
        />
      )}
      {verificationVideos.length > 0 && (
        <div className="cr-compare" aria-label="Preview recordings (admin-only)">
          <h3 className="cr-compare-title">Recording</h3>
          <div className="cr-compare-grid">
            {verificationVideos.map((video) => (
              <figure key={video.id} className="cr-shot cr-shot-video">
                {video.url ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption -- private admin evidence, no spoken audio track
                  <video src={video.url} controls preload="metadata" />
                ) : (
                  <div className="cr-shot-placeholder" role="note">
                    Couldn’t load this recording. Refresh the page to try again.
                  </div>
                )}
                <figcaption>{video.label ?? video.filename}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </EvidenceSection>
  )
}

/** Admin-uploaded attachments, shown in the detail page's sidebar. */
export async function ChangeRequestAttachments({
  files: filesPromise,
}: {
  files: Promise<ChangeRequestFileWithUrl[]>
}) {
  const attachments = (await filesPromise).filter((file) => file.kind === 'attachment')

  return (
    <>
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
                {THUMBNAIL_CONTENT_TYPES.has(file.content_type) ? (
                  <Thumbnail file={file} alt={`Preview of ${file.filename}`} />
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
    </>
  )
}
