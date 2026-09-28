import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { fetchPeopleNames } from '@/lib/change-request-people'
import { safeExternalUrl } from '@/lib/change-request-status'
import { paginationRange, parsePageParam, totalPageCount } from '@/lib/pagination'
import { Button } from '@/components/ui'
import { AdminPagination } from '@/components/features/AdminPagination'
import { ChangeRequestStatusBadge } from '@/components/features/ChangeRequestStatusBadge'
import type { ChangeRequest } from '@/types/change-request'

export const metadata: Metadata = {
  title: 'Website Requests',
}

type SearchParams = Promise<{ page?: string | string[] }>

type ChangeRequestListRow = Pick<
  ChangeRequest,
  'id' | 'title' | 'page_path' | 'status' | 'requester_id' | 'pr_url' | 'pr_number' | 'created_at'
>

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })
}

export default async function ChangeRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const params = await searchParams
  const page = parsePageParam(params.page)
  const { from, to } = paginationRange(page)

  const { data, count } = await supabase
    .from('change_requests')
    .select('id, title, page_path, status, requester_id, pr_url, pr_number, created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, to)

  const requests = (data ?? []) as ChangeRequestListRow[]
  const totalCount = count ?? 0
  const totalPages = totalPageCount(totalCount)
  if (page > totalPages && totalPages > 0) {
    redirect(`/admin/requests${totalPages > 1 ? `?page=${totalPages}` : ''}`)
  }

  const names = await fetchPeopleNames(
    supabase,
    requests.map((request) => request.requester_id)
  )

  return (
    <main className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Website Requests</h1>
          <p className="admin-page-subtitle">
            Ask for a change to the public website. The website agent opens a pull request and
            checks it on a preview site; nothing goes live until it is merged.
          </p>
        </div>
        <Button href="/admin/requests/new" size="sm" className="admin-button admin-button-primary">
          <span className="flex items-center gap-2">
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
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New request
          </span>
        </Button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
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
            {requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-empty">
                  No website requests yet. Use “New request” to ask for a change.
                </td>
              </tr>
            ) : (
              requests.map((request) => {
                const prUrl = safeExternalUrl(request.pr_url)
                return (
                  <tr key={request.id}>
                    <td>
                      <Link href={`/admin/requests/${request.id}`} className="admin-cell-primary">
                        {request.title}
                      </Link>
                    </td>
                    <td className="admin-cell-mono admin-cell-secondary hidden md:table-cell">
                      {request.page_path}
                    </td>
                    <td>
                      <ChangeRequestStatusBadge status={request.status} />
                    </td>
                    <td className="admin-cell-secondary hidden lg:table-cell">
                      {names.get(request.requester_id) ?? '—'}
                    </td>
                    <td className="admin-cell-mono admin-cell-secondary hidden sm:table-cell">
                      {formatDate(request.created_at)}
                    </td>
                    <td className="admin-cell-number">
                      {prUrl ? (
                        <a
                          href={prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="admin-button admin-button-bare"
                        >
                          {request.pr_number ? `#${request.pr_number}` : 'Open PR'}
                        </a>
                      ) : (
                        <span className="admin-cell-secondary">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <AdminPagination pathname="/admin/requests" page={page} totalCount={totalCount} />
    </main>
  )
}
