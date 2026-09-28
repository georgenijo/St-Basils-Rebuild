'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'

import { ChangeRequestNotification } from '@/emails/change-request-notification'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { withLogging } from '@/lib/logger.server'
import {
  CHANGE_REQUESTS_BUCKET,
  readStoredObjectHead,
  sweepAbandonedSubmissions,
  sweepStalePendingUploads,
} from '@/lib/change-request-storage'
import {
  UPLOAD_SESSION_TTL_MS,
  createUploadSession,
  parsePendingUploadPath,
  pendingUploadPath,
  verifyUploadSession,
} from '@/lib/change-request-uploads'
import { getSiteUrl } from '@/lib/site-url'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  MAX_CHANGE_REQUEST_ATTACHMENTS,
  MAX_CHANGE_REQUEST_ATTACHMENT_BYTES,
  attachmentUploadRequestSchema,
  changeRequestMessageSchema,
  changeRequestSchema,
  detectAttachmentType,
  sanitizeAttachmentFilename,
  type AttachmentContentType,
} from '@/lib/validators/change-request'

type ActionState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

export type PrepareUploadsResult =
  | {
      success: true
      sessionId: string
      sessionToken: string
      uploads: { path: string; token: string; signedUrl: string }[]
    }
  | { success: false; message: string }

const log = logger.child({ scope: 'change-requests' })

interface VerifiedAttachment {
  pendingPath: string
  storagePath: string
  contentType: AttachmentContentType
  filename: string
  size: number
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null, error: 'Unauthorized' as const }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { user: null, profile: null, error: 'Forbidden: admin access required' as const }
  }

  return { user, profile: profile as { role: string; full_name: string | null }, error: null }
}

function attachmentError(message: string): ActionState {
  return { success: false, message: 'Validation failed', errors: { attachments: [message] } }
}

async function removeObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  try {
    const { error } = await createAdminClient().storage.from(CHANGE_REQUESTS_BUCKET).remove(paths)
    if (error) log.error('change_request.attachment_cleanup_failed', { error, paths })
  } catch (error) {
    log.error('change_request.attachment_cleanup_failed', { error, paths })
  }
}

// ─── Direct uploads ──────────────────────────────────────────────────

/**
 * Step 1 of submitting attachments: validate the declared files and mint one
 * signed upload URL per file under a fresh `pending/<session>/` prefix. The
 * browser uploads the bytes straight to Storage, so they never pass through a
 * server action (Vercel limits function request bodies to 4.5 MB). The
 * returned session token binds the prefix to this admin; see
 * src/lib/change-request-uploads.ts.
 */
async function prepareChangeRequestUploadsImpl(files: unknown): Promise<PrepareUploadsResult> {
  const supabase = await createClient()
  const { user, error: authError } = await requireAdmin(supabase)
  if (authError || !user) return { success: false, message: authError ?? 'Unauthorized' }

  const parsed = attachmentUploadRequestSchema.safeParse(files)
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Invalid attachments',
    }
  }

  const session = createUploadSession(user.id)
  const storage = createAdminClient().storage.from(CHANGE_REQUESTS_BUCKET)
  const uploads: { path: string; token: string; signedUrl: string }[] = []

  for (const file of parsed.data) {
    const path = pendingUploadPath(
      session.sessionId,
      sanitizeAttachmentFilename(file.name, file.type)
    )
    const { data, error } = await storage.createSignedUploadUrl(path)
    if (error || !data) {
      log.error('change_request.sign_upload_failed', { error })
      return { success: false, message: 'Could not prepare the attachment upload. Try again.' }
    }
    uploads.push({ path, token: data.token, signedUrl: data.signedUrl })
  }

  // After responding, tidy uploads from sessions that were never submitted
  // and requests whose submission died between insert and queueing.
  after(async () => {
    try {
      await sweepStalePendingUploads({ olderThanMs: UPLOAD_SESSION_TTL_MS + 10 * 60 * 1000 })
    } catch (error) {
      log.warn('change_request.pending_sweep_failed', { error })
    }
    try {
      await sweepAbandonedSubmissions({ olderThanMs: 60 * 60 * 1000 })
    } catch (error) {
      log.warn('change_request.submitting_sweep_failed', { error })
    }
  })

  return {
    success: true,
    sessionId: session.sessionId,
    sessionToken: session.token,
    uploads,
  }
}

/**
 * Check every uploaded object the form refers to: it must sit under the
 * pending prefix minted for this admin, exist, be at most 10 MB for real, and
 * start with the magic bytes of an allowed type that matches its stored type.
 */
async function verifyPendingUploads(
  paths: string[],
  sessionId: string,
  requestId: string
): Promise<{ attachments: VerifiedAttachment[]; error: ActionState | null }> {
  if (paths.length > MAX_CHANGE_REQUEST_ATTACHMENTS) {
    return {
      attachments: [],
      error: attachmentError(`Attach at most ${MAX_CHANGE_REQUEST_ATTACHMENTS} files`),
    }
  }

  const attachments: VerifiedAttachment[] = []
  for (const path of paths) {
    const parsedPath = parsePendingUploadPath(path, sessionId)
    if (!parsedPath) {
      return { attachments: [], error: attachmentError('An attachment upload was not recognized') }
    }

    const head = await readStoredObjectHead(path)
    if (!head) {
      return {
        attachments: [],
        error: attachmentError(`${parsedPath.filename} did not finish uploading`),
      }
    }
    if (head.size <= 0 || head.size > MAX_CHANGE_REQUEST_ATTACHMENT_BYTES) {
      return {
        attachments: [],
        error: attachmentError(`${parsedPath.filename} is empty or larger than 10 MB`),
      }
    }

    const contentType = detectAttachmentType(head.bytes)
    const storedType = head.contentType?.split(';')[0].trim().toLowerCase()
    if (
      !contentType ||
      storedType !== contentType ||
      sanitizeAttachmentFilename(parsedPath.filename, contentType) !== parsedPath.filename
    ) {
      return {
        attachments: [],
        error: attachmentError(
          `${parsedPath.filename} is not a valid PNG, JPEG, WebP, GIF, or PDF file`
        ),
      }
    }

    attachments.push({
      pendingPath: path,
      storagePath: `requests/${requestId}/attachments/${parsedPath.objectName}`,
      contentType,
      filename: parsedPath.filename,
      size: head.size,
    })
  }

  return { attachments, error: null }
}

async function notifyNewRequest(details: {
  requestId: string
  title: string
  pagePath: string
  description: string
  requesterName: string
  attachmentCount: number
}): Promise<void> {
  const to = process.env.CHANGE_REQUEST_NOTIFY_EMAIL?.trim()
  if (!to) {
    log.info('change_request.notify_skipped', { reason: 'CHANGE_REQUEST_NOTIFY_EMAIL unset' })
    return
  }

  const siteUrl = getSiteUrl()
  const requestUrl = `${siteUrl}/admin/requests/${details.requestId}`

  try {
    const { error } = await sendEmail({
      from: "St. Basil's Website <noreply@stbasilsboston.org>",
      to: to
        .split(',')
        .map((address) => address.trim())
        .filter(Boolean),
      subject: `Website change request: ${details.title}`,
      react: ChangeRequestNotification({
        title: details.title,
        pagePath: details.pagePath,
        requesterName: details.requesterName,
        description: details.description,
        attachmentCount: details.attachmentCount,
        requestUrl,
        siteUrl,
      }),
      metadata: {
        template: 'change-request-notification',
        requestId: details.requestId,
        requestUrl,
        title: details.title,
        pagePath: details.pagePath,
        requesterName: details.requesterName,
      },
    })
    if (error) log.error('change_request.notify_failed', { error, requestId: details.requestId })
  } catch (error) {
    log.error('change_request.notify_failed', { error, requestId: details.requestId })
  }
}

/**
 * Submit a change request. Attachments were already uploaded straight to
 * Storage (see prepareChangeRequestUploads); the form carries only their
 * pending paths plus the upload session id and token.
 *
 * Two-phase and all-or-nothing: uploads are verified and moved to
 * `requests/<id>/attachments/`, the request row is inserted as `submitting`
 * (RLS client; the worker only claims `queued`), the file rows are recorded,
 * and only then does the service role flip it to `queued` and the
 * notification go out. If any step before the flip fails, everything is
 * rolled back (moved and pending objects removed, request row deleted with
 * the service role) and the admin sees an error with the form intact, so a
 * half-submitted request is never left in the queue. Pending objects are also
 * removed when the submission is rejected for invalid fields; the form
 * re-uploads on the next attempt.
 */
async function createChangeRequestImpl(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Auth + admin check
  const supabase = await createClient()
  const { user, profile, error: authError } = await requireAdmin(supabase)
  if (authError || !user) return { success: false, message: authError ?? 'Unauthorized' }

  // 2. Resolve the upload session (only objects minted for this admin)
  const pendingPaths = Array.from(
    new Set(
      formData
        .getAll('attachment_paths')
        .filter((value): value is string => typeof value === 'string' && value !== '')
    )
  )
  const sessionId = formData.get('upload_session')
  if (
    pendingPaths.length > 0 &&
    !verifyUploadSession(user.id, sessionId, formData.get('upload_token'))
  ) {
    return attachmentError(
      'The attachment upload expired. Remove and re-attach the files, then submit again.'
    )
  }
  const sessionPaths =
    typeof sessionId === 'string'
      ? pendingPaths.filter((path) => parsePendingUploadPath(path, sessionId))
      : []
  const discardPending = () => removeObjects(sessionPaths)

  // 3. Validate fields
  const parsed = changeRequestSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    page_path: formData.get('page_path'),
    target_selector: formData.get('target_selector'),
    target_text: formData.get('target_text'),
  })

  if (!parsed.success) {
    await discardPending()
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // 4. Verify the uploaded objects (location, real size, magic bytes)
  const requestId = crypto.randomUUID()
  let attachments: VerifiedAttachment[] = []
  if (pendingPaths.length > 0) {
    try {
      const verified = await verifyPendingUploads(pendingPaths, sessionId as string, requestId)
      if (verified.error) {
        await discardPending()
        return verified.error
      }
      attachments = verified.attachments
    } catch (error) {
      log.error('change_request.attachment_verify_failed', { error })
      await discardPending()
      return { success: false, message: 'Could not check the attachments. Try again.' }
    }
  }

  const failure: ActionState = {
    success: false,
    message: 'Could not save the request and its attachments. Nothing was submitted; try again.',
  }

  // 5. Move verified uploads into the request's folder
  const movedPaths: string[] = []
  // Removing keys that no longer exist is a no-op, so clear both locations.
  const rollbackObjects = () => removeObjects([...movedPaths, ...sessionPaths])
  if (attachments.length > 0) {
    const storage = createAdminClient().storage.from(CHANGE_REQUESTS_BUCKET)
    for (const attachment of attachments) {
      const { error } = await storage.move(attachment.pendingPath, attachment.storagePath)
      if (error) {
        log.error('change_request.attachment_move_failed', { error, requestId })
        await rollbackObjects()
        return failure
      }
      movedPaths.push(attachment.storagePath)
    }
  }

  // 6. Insert the request as the signed-in admin (RLS enforces requester + status),
  //    as 'submitting': not claimable until step 8 flips it to 'queued'.
  const { error: insertError } = await supabase.from('change_requests').insert({
    id: requestId,
    requester_id: user.id,
    status: 'submitting',
    title: parsed.data.title,
    description: parsed.data.description,
    page_path: parsed.data.page_path,
    target_selector: parsed.data.target_selector ?? null,
    target_text: parsed.data.target_text ?? null,
  })

  if (insertError) {
    log.error('change_request.create_failed', { error: insertError })
    await rollbackObjects()
    return { success: false, message: 'Failed to submit the change request' }
  }

  // 7. Record file rows with the service role (no user-facing insert policy)
  const admin = createAdminClient()
  const uncertain: ActionState = {
    success: false,
    message:
      'We could not confirm whether your request was submitted. It may still be processing; check Website Requests before submitting it again.',
  }

  // Delete the row only while it is still 'submitting', and remove its files
  // only once that delete is confirmed, so a request that was queued (or
  // claimed) meanwhile is never torn down.
  const rollbackRequest = async (): Promise<'deleted' | 'kept' | 'unknown'> => {
    const { data: deleted, error: rollbackError } = await admin
      .from('change_requests')
      .delete()
      .eq('id', requestId)
      .eq('status', 'submitting')
      .select('id')
    if (rollbackError) {
      log.error('change_request.rollback_failed', { error: rollbackError, requestId })
      return 'unknown'
    }
    if ((deleted?.length ?? 0) === 0) {
      log.warn('change_request.rollback_skipped', { requestId })
      return 'kept'
    }
    await rollbackObjects()
    return 'deleted'
  }

  if (attachments.length > 0) {
    const { error: filesError } = await admin.from('change_request_files').insert(
      attachments.map((attachment) => ({
        request_id: requestId,
        kind: 'attachment',
        storage_path: attachment.storagePath,
        filename: attachment.filename,
        content_type: attachment.contentType,
        size_bytes: attachment.size,
      }))
    )

    if (filesError) {
      log.error('change_request.attachment_record_failed', { error: filesError, requestId })
      return (await rollbackRequest()) === 'deleted' ? failure : uncertain
    }
  }

  // 8. Make it claimable: flip 'submitting' → 'queued' now that it is complete.
  //    If the flip is not confirmed (error or lost response), re-read the row:
  //    it may already be queued or even claimed by the worker.
  const { data: queued, error: queueError } = await admin
    .from('change_requests')
    .update({ status: 'queued' })
    .eq('id', requestId)
    .eq('status', 'submitting')
    .select('id')

  if (queueError || (queued?.length ?? 0) === 0) {
    log.error('change_request.queue_unconfirmed', { error: queueError, requestId })
    const { data: current, error: readError } = await admin
      .from('change_requests')
      .select('status')
      .eq('id', requestId)
      .maybeSingle()

    if (readError) {
      log.error('change_request.queue_state_unknown', { error: readError, requestId })
      return uncertain
    }
    if (!current) {
      // Row is gone (nothing to queue); its files would be orphaned.
      await rollbackObjects()
      return failure
    }
    if ((current as { status: string }).status === 'submitting') {
      const outcome = await rollbackRequest()
      return outcome === 'deleted' ? failure : uncertain
    }
    // Already queued or further along: the submission went through.
    log.info('change_request.queue_confirmed_on_reread', {
      requestId,
      status: (current as { status: string }).status,
    })
  }

  log.info('change_request.created', { requestId, attachments: attachments.length })

  // 9. Notify (never fails the submission)
  await notifyNewRequest({
    requestId,
    title: parsed.data.title,
    pagePath: parsed.data.page_path,
    description: parsed.data.description,
    requesterName: profile?.full_name || user.email || 'An administrator',
    attachmentCount: attachments.length,
  })

  revalidatePath('/admin/requests')
  redirect(`/admin/requests/${requestId}`)
}

/**
 * Post a requester reply. Replying to a `needs_attention` request sends it
 * back to the queue; the worker re-reads the whole thread on each attempt.
 */
async function addChangeRequestMessageImpl(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Auth + admin check
  const supabase = await createClient()
  const { user, profile, error: authError } = await requireAdmin(supabase)
  if (authError || !user) return { success: false, message: authError ?? 'Unauthorized' }

  // 2. Validate
  const parsed = changeRequestMessageSchema.safeParse({
    request_id: formData.get('request_id'),
    body: formData.get('body'),
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { request_id: requestId, body } = parsed.data

  // 3. Load the request (RLS: admins only)
  const { data: request, error: requestError } = await supabase
    .from('change_requests')
    .select('id, status')
    .eq('id', requestId)
    .maybeSingle()

  if (requestError || !request) {
    if (requestError) log.error('change_request.load_failed', { error: requestError, requestId })
    return { success: false, message: 'Change request not found' }
  }

  // 4. Insert the reply as the signed-in admin
  const { error: messageError } = await supabase.from('change_request_messages').insert({
    request_id: requestId,
    author_kind: 'requester',
    author_id: user.id,
    body,
  })

  if (messageError) {
    log.error('change_request.message_failed', { error: messageError, requestId })
    return { success: false, message: 'Failed to post your reply' }
  }

  // 5. Requeue a request that was waiting on a person
  let requeued = false
  if (request.status === 'needs_attention') {
    const admin = createAdminClient()
    const { data: updated, error: requeueError } = await admin
      .from('change_requests')
      .update({ status: 'queued', claimed_by: null, claimed_at: null })
      .eq('id', requestId)
      .eq('status', 'needs_attention')
      .select('id')

    if (requeueError) {
      log.error('change_request.requeue_failed', { error: requeueError, requestId })
      revalidatePath(`/admin/requests/${requestId}`)
      return {
        success: false,
        message: 'Your reply was posted, but the request could not be sent back to the queue.',
      }
    }

    requeued = (updated?.length ?? 0) > 0
    if (requeued) {
      const who = profile?.full_name || user.email || 'the requester'
      const { error: systemError } = await admin.from('change_request_messages').insert({
        request_id: requestId,
        author_kind: 'system',
        author_id: null,
        body: `Requeued after a reply from ${who}. The agent will pick it up again and re-read the whole thread.`,
      })
      if (systemError) {
        log.error('change_request.system_message_failed', { error: systemError, requestId })
      }
      log.info('change_request.requeued', { requestId })
    }
  }

  revalidatePath(`/admin/requests/${requestId}`)
  revalidatePath('/admin/requests')
  return {
    success: true,
    message: requeued ? 'Reply posted. The request is back in the queue.' : 'Reply posted.',
  }
}

export const prepareChangeRequestUploads = withLogging(
  'prepareChangeRequestUploads',
  prepareChangeRequestUploadsImpl
)
export const createChangeRequest = withLogging('createChangeRequest', createChangeRequestImpl)
export const addChangeRequestMessage = withLogging(
  'addChangeRequestMessage',
  addChangeRequestMessageImpl
)
