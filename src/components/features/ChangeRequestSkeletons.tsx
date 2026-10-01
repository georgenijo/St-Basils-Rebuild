import { cn } from '@/lib/utils'

/**
 * Placeholders for the website-request pages: shown by the routes'
 * loading.tsx on navigation and as Suspense fallbacks while slower sections
 * (conversation, evidence, attachments) stream in after the header.
 */
export function SkeletonBar({ className, width }: { className?: string; width?: string }) {
  return <span className={cn('cr-skeleton', className)} style={width ? { width } : undefined} />
}

function SrLoading({ label }: { label: string }) {
  return <span className="sr-only">{label}</span>
}

export function ChangeRequestListSkeleton() {
  return (
    <main className="admin-page" aria-busy="true" data-testid="change-requests-loading">
      <div className="admin-page-head">
        <div>
          <h1>Website Requests</h1>
          <p className="admin-page-subtitle">
            Ask for a change to the public website. The website agent opens a pull request and
            checks it on a preview site; nothing goes live until it is merged.
          </p>
        </div>
      </div>
      <div className="admin-table-wrap" role="status">
        <SrLoading label="Loading requests…" />
        <table className="admin-table" aria-hidden="true">
          <thead>
            <tr>
              <th>Title</th>
              <th className="hidden md:table-cell">Page</th>
              <th>Status</th>
              <th className="hidden lg:table-cell">Requester</th>
              <th className="hidden sm:table-cell">Created</th>
              <th className="admin-cell-number">PR</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, index) => (
              <tr key={index}>
                <td>
                  <SkeletonBar width={`${55 + ((index * 17) % 35)}%`} />
                </td>
                <td className="hidden md:table-cell">
                  <SkeletonBar width="70%" />
                </td>
                <td>
                  <SkeletonBar className="cr-skeleton-pill" />
                </td>
                <td className="hidden lg:table-cell">
                  <SkeletonBar width="60%" />
                </td>
                <td className="hidden sm:table-cell">
                  <SkeletonBar width="80%" />
                </td>
                <td className="admin-cell-number">
                  <SkeletonBar width="32px" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

export function ChangeRequestThreadSkeleton() {
  return (
    <div role="status" className="cr-thread" data-testid="change-request-thread-loading">
      <SrLoading label="Loading conversation…" />
      {['start', 'end', 'start'].map((align, index) => (
        <div key={index} className="cr-skeleton-message" data-align={align} aria-hidden="true">
          <SkeletonBar width="30%" />
          <SkeletonBar width="90%" />
          <SkeletonBar width="65%" />
        </div>
      ))}
    </div>
  )
}

export function ChangeRequestGallerySkeleton({ tiles = 2 }: { tiles?: number }) {
  return (
    <div role="status" data-testid="change-request-evidence-loading">
      <SrLoading label="Loading screenshots…" />
      <div className="cr-shots" aria-hidden="true">
        {Array.from({ length: tiles }).map((_, index) => (
          <span key={index} className="cr-skeleton cr-skeleton-tile" />
        ))}
      </div>
    </div>
  )
}

export function ChangeRequestAttachmentsSkeleton() {
  return (
    <div role="status">
      <SrLoading label="Loading attachments…" />
      <div className="cr-files" aria-hidden="true">
        <span className="cr-skeleton cr-skeleton-file" />
      </div>
    </div>
  )
}

export function ChangeRequestDetailSkeleton() {
  return (
    <main className="admin-page" aria-busy="true" data-testid="change-request-loading">
      <div className="mb-6">
        <SkeletonBar width="140px" className="cr-skeleton-button" />
      </div>
      <div className="admin-page-head">
        <div className="cr-skeleton-stack" role="status">
          <SrLoading label="Loading request…" />
          <SkeletonBar className="cr-skeleton-title" width="min(420px, 80%)" />
          <SkeletonBar width="min(320px, 60%)" />
        </div>
      </div>
      <div className="cr-status-card" aria-hidden="true">
        <SkeletonBar className="cr-skeleton-pill" />
        <SkeletonBar width="70%" />
      </div>
      <div className="cr-detail-grid" aria-hidden="true">
        <div>
          <section className="admin-section">
            <div className="admin-section-head">
              <h2>Request</h2>
            </div>
            <div className="cr-skeleton-stack" style={{ marginTop: 12 }}>
              <SkeletonBar width="95%" />
              <SkeletonBar width="85%" />
              <SkeletonBar width="40%" />
            </div>
          </section>
          <section className="admin-section">
            <div className="admin-section-head">
              <h2>Conversation</h2>
            </div>
            <ChangeRequestThreadSkeleton />
          </section>
        </div>
        <aside>
          <section className="admin-section">
            <div className="admin-section-head">
              <h2>Attachments</h2>
            </div>
            <ChangeRequestAttachmentsSkeleton />
          </section>
        </aside>
      </div>
    </main>
  )
}
