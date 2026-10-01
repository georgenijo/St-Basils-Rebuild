import { NextResponse } from 'next/server'

import { THUMBNAIL_CONTENT_TYPES, UUID_PATTERN } from '@/lib/change-request-detail'
import { CHANGE_REQUESTS_BUCKET } from '@/lib/change-request-storage'
import { renderThumbnail } from '@/lib/change-request-thumbnails'
import { logger } from '@/lib/logger'
import { withRequestLogging } from '@/lib/logger.server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthWithProfile, getDataClient } from '@/lib/supabase/auth'

export const dynamic = 'force-dynamic'

const log = logger.child({ scope: 'change-requests' })

interface RouteContext {
  params: Promise<{ id: string; fileId: string }>
}

function notFound() {
  return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
}

/**
 * Small WebP preview of a private request image (agent screenshot or admin
 * attachment). The detail page renders these in its galleries and links the
 * tile to the full-size signed URL. The URL is stable per file row, so the
 * browser caches it across the page's auto-refreshes, unlike signed URLs,
 * which change on every render.
 */
async function getImpl(_request: Request, { params }: RouteContext) {
  const { id, fileId } = await params
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(fileId)) return notFound()

  // Route handlers sit outside the admin layout, so authorize here too.
  const { user, profile } = await getAuthWithProfile()
  if (!user || profile?.role !== 'admin') return notFound()

  // Read the row under the admin's session (RLS) rather than the service role.
  const supabase = await getDataClient()
  const { data: file } = await supabase
    .from('change_request_files')
    .select('storage_path, content_type')
    .eq('id', fileId)
    .eq('request_id', id)
    .maybeSingle()
  if (!file || !THUMBNAIL_CONTENT_TYPES.has(file.content_type)) return notFound()

  const storage = createAdminClient().storage.from(CHANGE_REQUESTS_BUCKET)
  const { data: blob, error } = await storage.download(file.storage_path)
  if (error || !blob) {
    log.warn('change_request.thumbnail_download_failed', { fileId, error })
    return notFound()
  }

  try {
    const thumbnail = await renderThumbnail(new Uint8Array(await blob.arrayBuffer()))
    return new NextResponse(new Uint8Array(thumbnail), {
      headers: {
        'Content-Type': 'image/webp',
        // File rows are immutable: a re-uploaded screenshot gets a new row id.
        'Cache-Control': 'private, max-age=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (renderError) {
    // Fall back to the original image rather than a broken tile.
    log.warn('change_request.thumbnail_render_failed', { fileId, error: renderError })
    const { data: signed } = await storage.createSignedUrl(file.storage_path, 60)
    if (!signed?.signedUrl) return notFound()
    return NextResponse.redirect(signed.signedUrl, {
      status: 307,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}

export const GET = withRequestLogging('/admin/requests/[id]/files/[fileId]/thumbnail', getImpl)
