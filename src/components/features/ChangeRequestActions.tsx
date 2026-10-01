'use client'

import { startTransition, useActionState, useState } from 'react'

import { closeChangeRequest } from '@/actions/change-requests'
import { Button } from '@/components/ui'
import { CHANGE_REQUEST_CLOSE_REASON_MAX } from '@/lib/validators/change-request'

const initialState = {
  success: false,
  message: '',
  errors: undefined as Record<string, string[]> | undefined,
}

/**
 * Admin decisions for a request (close today; approve/merge and undo join it
 * later). Kept out of the detail page so the page only decides which actions
 * apply to the current status.
 */
export function ChangeRequestActions({
  requestId,
  canClose,
  hasPullRequest,
}: {
  requestId: string
  canClose: boolean
  hasPullRequest: boolean
}) {
  const [closeState, closeAction, isClosing] = useActionState(closeChangeRequest, initialState)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [reason, setReason] = useState('')

  // Stay mounted after a rejected close (e.g. the agent claimed the request
  // first and the page refreshed) so the explanation is still shown.
  const closeRejected = !closeState.success && Boolean(closeState.message)
  if (!canClose && !closeRejected) return null
  if (!canClose) {
    return (
      <div className="cr-actions" data-testid="change-request-actions">
        <p className="cr-field-error" role="alert">
          {closeState.message}
        </p>
      </div>
    )
  }

  function handleClose(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData()
    formData.set('request_id', requestId)
    formData.set('reason', reason)
    startTransition(() => closeAction(formData))
  }

  const closeError =
    closeState.errors?.reason?.[0] ?? (!closeState.success ? closeState.message : '')

  return (
    <div className="cr-actions" data-testid="change-request-actions">
      {!confirmingClose ? (
        <Button
          type="button"
          className="admin-button admin-button-quiet"
          onClick={() => setConfirmingClose(true)}
        >
          Close request…
        </Button>
      ) : (
        <form onSubmit={handleClose} className="cr-close-form" aria-label="Close request">
          <label htmlFor="close-reason">Why are you closing this request?</label>
          <textarea
            id="close-reason"
            value={reason}
            maxLength={CHANGE_REQUEST_CLOSE_REASON_MAX}
            onChange={(event) => setReason(event.target.value)}
            placeholder="For example: no longer needed, or done another way."
          />
          <p className="cr-help">
            {hasPullRequest
              ? 'The agent closes any open pull request and deletes its branch. Nothing changes on the live site, and the request is not worked on again. The reason stays private to admins.'
              : 'Nothing changes on the live site, and the request is not worked on again. The reason stays private to admins.'}
          </p>
          {closeError && (
            <p className="cr-field-error" role="alert">
              {closeError}
            </p>
          )}
          <div className="cr-reply-actions">
            <Button
              type="button"
              className="admin-button admin-button-bare"
              onClick={() => setConfirmingClose(false)}
              disabled={isClosing}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="admin-button admin-button-primary"
              disabled={isClosing || reason.trim().length < 3}
            >
              {isClosing ? 'Closing…' : 'Close request'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
