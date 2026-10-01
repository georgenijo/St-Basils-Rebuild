'use client'

import Link from 'next/link'
import { startTransition, useActionState, useState } from 'react'

import { undoChangeRequest } from '@/actions/change-requests'
import { Button } from '@/components/ui'

const initialState = { success: false, message: '' }

/**
 * Undo for a merged or live change (#363), and the links between an original
 * request and its undo. Starting an undo creates a linked request that
 * reverts the change through the normal review path; the action redirects
 * to it.
 */
export function ChangeRequestUndo({
  requestId,
  canUndo,
  undoRequestId,
  revertOf,
}: {
  requestId: string
  canUndo: boolean
  /** The undo already in progress (or done) for this request. */
  undoRequestId: string | null
  /** When this request is itself an undo: the original request. */
  revertOf: string | null
}) {
  const [state, undoAction, isUndoing] = useActionState(undoChangeRequest, initialState)
  const [confirming, setConfirming] = useState(false)

  if (!canUndo && !undoRequestId && !revertOf) return null

  function handleUndo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData()
    formData.set('request_id', requestId)
    startTransition(() => undoAction(formData))
  }

  return (
    <div className="cr-merge" data-testid="change-request-undo">
      {revertOf && (
        <p className="cr-help">
          This request undoes an earlier change.{' '}
          <Link href={`/admin/requests/${revertOf}`}>View the original request</Link>
        </p>
      )}
      {undoRequestId ? (
        <p className="cr-help">
          An undo for this change has been requested.{' '}
          <Link href={`/admin/requests/${undoRequestId}`}>View the undo request</Link>
        </p>
      ) : (
        canUndo &&
        (!confirming ? (
          <Button
            type="button"
            className="admin-button admin-button-quiet"
            onClick={() => setConfirming(true)}
          >
            Undo this change…
          </Button>
        ) : (
          <form onSubmit={handleUndo} className="cr-close-form" aria-label="Undo this change">
            <p className="cr-help">
              This opens a new request that reverts this change. It gets the same checks and preview
              verification, and the live site only changes back once it is approved and merged.
            </p>
            <div className="cr-reply-actions">
              <Button
                type="button"
                className="admin-button admin-button-bare"
                onClick={() => setConfirming(false)}
                disabled={isUndoing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="admin-button admin-button-primary"
                disabled={isUndoing}
              >
                {isUndoing ? 'Starting…' : 'Start undo'}
              </Button>
            </div>
          </form>
        ))
      )}
      {!state.success && state.message && (
        <p className="cr-field-error" role="alert">
          {state.message}
        </p>
      )}
    </div>
  )
}
