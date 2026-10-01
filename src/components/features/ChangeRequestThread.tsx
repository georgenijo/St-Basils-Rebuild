import { formatChangeRequestDateTime } from '@/lib/change-request-detail'
import { cn } from '@/lib/utils'
import type { ChangeRequestMessage } from '@/types/change-request'

/** Conversation messages; streamed in after the page header. */
export async function ChangeRequestThread({
  messages: messagesPromise,
  names: namesPromise,
}: {
  messages: Promise<ChangeRequestMessage[]>
  names: Promise<Map<string, string>>
}) {
  const [messages, names] = await Promise.all([messagesPromise, namesPromise])

  if (messages.length === 0) {
    return (
      <p className="cr-help" style={{ marginTop: 12 }}>
        No messages yet. The website agent posts progress here as it works.
      </p>
    )
  }

  return (
    <ol className="cr-thread" data-testid="change-request-thread">
      {messages.map((message) => (
        <li key={message.id} className="cr-message" data-kind={message.author_kind}>
          {message.author_kind !== 'system' && (
            <div className="cr-message-head">
              <span className="cr-message-author">
                {message.author_kind === 'agent'
                  ? 'Website agent'
                  : ((message.author_id && names.get(message.author_id)) ?? 'Admin')}
              </span>
              {message.intent && (
                <span
                  className={cn(
                    'admin-status',
                    message.intent === 'revision' && 'admin-status-warn'
                  )}
                >
                  {message.intent === 'revision' ? 'Requested changes' : 'Note'}
                </span>
              )}
              <span className="admin-meta">{formatChangeRequestDateTime(message.created_at)}</span>
            </div>
          )}
          <p className="cr-message-body">{message.body}</p>
        </li>
      ))}
    </ol>
  )
}

/** Message count for the Conversation heading; streams with the thread. */
export async function ChangeRequestMessageCount({
  messages,
}: {
  messages: Promise<ChangeRequestMessage[]>
}) {
  return <span className="admin-meta">{(await messages).length}</span>
}
