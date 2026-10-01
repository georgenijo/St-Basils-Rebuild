'use client'

import { startTransition, useActionState, useEffect, useState } from 'react'

import { addChangeRequestMessage } from '@/actions/change-requests'
import { Button } from '@/components/ui'
import {
  CHANGE_REQUEST_MESSAGE_MAX,
  type ChangeRequestReplyIntent,
} from '@/lib/validators/change-request'

const initialState = {
  success: false,
  message: '',
  errors: undefined as Record<string, string[]> | undefined,
}

type ReadyIntent = Extract<ChangeRequestReplyIntent, 'note' | 'revision'>

const INTENT_OPTIONS: { value: ReadyIntent; label: string; description: string }[] = [
  {
    value: 'note',
    label: 'Add a note',
    description: 'Saved to the conversation only. The agent does not act on it.',
  },
  {
    value: 'revision',
    label: 'Request changes',
    description:
      'Sends it back to the agent, which updates the same pull request, re-runs the checks and verifies the preview again.',
  },
]

export function ChangeRequestReplyForm({
  requestId,
  requeuesOnReply,
  canRequestChanges = false,
}: {
  requestId: string
  requeuesOnReply: boolean
  /** Ready-for-review requests offer "Request changes" next to plain notes. */
  canRequestChanges?: boolean
}) {
  const [state, formAction, isPending] = useActionState(addChangeRequestMessage, initialState)
  const [body, setBody] = useState('')
  const [intent, setIntent] = useState<ReadyIntent>('note')

  useEffect(() => {
    if (state.success) {
      setBody('')
      setIntent('note')
    }
  }, [state])

  const revising = canRequestChanges && intent === 'revision'

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData()
    formData.set('request_id', requestId)
    // The server only honours note/revision while the request is still ready,
    // and only requeues a needs_attention request for an explicit requeue.
    const sent: ChangeRequestReplyIntent = canRequestChanges
      ? intent
      : requeuesOnReply
        ? 'requeue'
        : 'reply'
    formData.set('intent', sent)
    formData.set('body', body)
    startTransition(() => formAction(formData))
  }

  const error = state.errors?.body?.[0] ?? (!state.success ? state.message : '')

  let placeholder = 'Add a note or clarification to this request.'
  let help = 'Replies are saved to the thread.'
  let submitLabel = 'Send reply'
  if (requeuesOnReply) {
    placeholder =
      'Answer the question or clarify the request. Sending this puts the request back in the queue.'
    help = 'The agent re-reads the whole thread when it retries.'
    submitLabel = 'Reply and requeue'
  } else if (revising) {
    placeholder = 'Describe what should change, e.g. "Make the heading bigger."'
    help = 'The agent re-reads the whole thread and revises the same pull request.'
    submitLabel = 'Request changes'
  } else if (canRequestChanges) {
    help = 'Notes are saved to the thread; nothing is sent to the agent.'
    submitLabel = 'Save note'
  }

  return (
    <form onSubmit={handleSubmit} className="cr-reply">
      {canRequestChanges && (
        <fieldset className="cr-reply-intent" data-testid="reply-intent">
          <legend>What should this reply do?</legend>
          {INTENT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="cr-reply-intent-option"
              data-selected={intent === option.value}
            >
              <input
                type="radio"
                name="reply-intent"
                value={option.value}
                checked={intent === option.value}
                onChange={() => setIntent(option.value)}
              />
              <span className="cr-reply-intent-label">{option.label}</span>
              <span className="cr-help">{option.description}</span>
            </label>
          ))}
        </fieldset>
      )}
      <label htmlFor="reply-body">{revising ? 'Requested changes' : 'Reply'}</label>
      <textarea
        id="reply-body"
        value={body}
        maxLength={CHANGE_REQUEST_MESSAGE_MAX}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
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
        <span className="cr-help">{help}</span>
        <Button
          type="submit"
          disabled={isPending || body.trim().length === 0}
          className="admin-button admin-button-primary"
        >
          {isPending ? 'Sending…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
