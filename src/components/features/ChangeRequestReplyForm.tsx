'use client'

import { startTransition, useActionState, useEffect, useState } from 'react'

import { addChangeRequestMessage } from '@/actions/change-requests'
import { Button } from '@/components/ui'
import { CHANGE_REQUEST_MESSAGE_MAX } from '@/lib/validators/change-request'

const initialState = {
  success: false,
  message: '',
  errors: undefined as Record<string, string[]> | undefined,
}

export function ChangeRequestReplyForm({
  requestId,
  requeuesOnReply,
}: {
  requestId: string
  requeuesOnReply: boolean
}) {
  const [state, formAction, isPending] = useActionState(addChangeRequestMessage, initialState)
  const [body, setBody] = useState('')

  useEffect(() => {
    if (state.success) setBody('')
  }, [state])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData()
    formData.set('request_id', requestId)
    formData.set('body', body)
    startTransition(() => formAction(formData))
  }

  const error = state.errors?.body?.[0] ?? (!state.success ? state.message : '')

  return (
    <form onSubmit={handleSubmit} className="cr-reply">
      <label htmlFor="reply-body">Reply</label>
      <textarea
        id="reply-body"
        value={body}
        maxLength={CHANGE_REQUEST_MESSAGE_MAX}
        onChange={(event) => setBody(event.target.value)}
        placeholder={
          requeuesOnReply
            ? 'Answer the question or clarify the request. Sending this puts the request back in the queue.'
            : 'Add a note or clarification to this request.'
        }
      />
      {error && (
        <p className="cr-field-error" role="alert">
          {error}
        </p>
      )}
      {state.success && state.message && (
        <p className="cr-help" role="status">
          {state.message}
        </p>
      )}
      <div className="cr-reply-actions">
        <span className="cr-help">
          {requeuesOnReply
            ? 'The agent re-reads the whole thread when it retries.'
            : 'Replies are saved to the thread.'}
        </span>
        <Button
          type="submit"
          disabled={isPending || body.trim().length === 0}
          className="admin-button admin-button-primary"
        >
          {isPending ? 'Sending…' : requeuesOnReply ? 'Reply and requeue' : 'Send reply'}
        </Button>
      </div>
    </form>
  )
}
