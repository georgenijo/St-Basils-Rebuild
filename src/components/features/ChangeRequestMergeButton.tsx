'use client'

import { startTransition, useActionState, useState } from 'react'

import { approveAndMergeChangeRequest } from '@/actions/change-requests'
import { Button } from '@/components/ui'

const initialState = { success: false, message: '' }

/**
 * "Approve & merge" with a confirmation step. `blockedReason` comes from a
 * server-side readiness check; the action re-checks everything before merging.
 */
export function ChangeRequestMergeButton({
  requestId,
  verifiedSha,
  blockedReason,
}: {
  requestId: string
  /** The verified commit shown on the page: approval is bound to it. */
  verifiedSha: string
  blockedReason: string | null
}) {
  const [state, mergeAction, isMerging] = useActionState(approveAndMergeChangeRequest, initialState)
  const [confirming, setConfirming] = useState(false)

  function handleMerge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData()
    formData.set('request_id', requestId)
    formData.set('verified_sha', verifiedSha)
    startTransition(() => mergeAction(formData))
  }

  return (
    <div className="cr-merge" data-testid="change-request-merge">
      {!confirming ? (
        <Button
          type="button"
          className="admin-button admin-button-primary"
          disabled={Boolean(blockedReason)}
          aria-describedby={blockedReason ? 'merge-blocked-reason' : undefined}
          onClick={() => setConfirming(true)}
        >
          Approve &amp; merge
        </Button>
      ) : (
        <form onSubmit={handleMerge} className="cr-close-form" aria-label="Approve and merge">
          <p className="cr-help">
            This publishes verified commit <code>{verifiedSha.slice(0, 7)}</code> to
            stbasilsboston.org. Vercel deploys it a few minutes after the merge.
          </p>
          <div className="cr-reply-actions">
            <Button
              type="button"
              className="admin-button admin-button-bare"
              onClick={() => setConfirming(false)}
              disabled={isMerging}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="admin-button admin-button-primary"
              disabled={isMerging}
            >
              {isMerging ? 'Merging…' : 'Merge and publish'}
            </Button>
          </div>
        </form>
      )}
      {blockedReason && (
        <p id="merge-blocked-reason" className="cr-help">
          Can’t merge yet: {blockedReason}
        </p>
      )}
      {state.message && (
        <p
          className={state.success ? 'cr-help' : 'cr-field-error'}
          role={state.success ? 'status' : 'alert'}
        >
          {state.message}
        </p>
      )}
    </div>
  )
}
