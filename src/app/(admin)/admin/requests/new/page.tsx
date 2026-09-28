import type { Metadata } from 'next'
import Link from 'next/link'

import { ChangeRequestForm } from '@/components/features/ChangeRequestForm'
import { CHANGE_REQUEST_PAGE_PATH_PATTERN } from '@/lib/validators/change-request'

export const metadata: Metadata = {
  title: 'New Website Request',
}

type SearchParams = Promise<{ path?: string | string[] }>

export default async function NewChangeRequestPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const rawPath = Array.isArray(params.path) ? params.path[0] : params.path
  const initialPath =
    rawPath && CHANGE_REQUEST_PAGE_PATH_PATTERN.test(rawPath) && rawPath.length <= 300
      ? rawPath
      : '/'

  return (
    <main className="admin-page">
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
        <h1 className="mt-2 font-heading text-3xl font-semibold text-wood-900">
          New Website Request
        </h1>
      </div>

      <ChangeRequestForm initialPath={initialPath} />
    </main>
  )
}
