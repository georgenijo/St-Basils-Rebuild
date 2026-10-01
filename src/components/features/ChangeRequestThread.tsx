import type { ReactNode } from 'react'

import { formatChangeRequestDateTime } from '@/lib/change-request-detail'
import {
  classifySystemEvent,
  parseMessageBlocks,
  type InlineToken,
  type MessageBlock,
  type SystemEventAction,
  type SystemEventKind,
  type ThreadContext,
} from '@/lib/change-request-thread'
import { cn } from '@/lib/utils'
import type { ChangeRequestMessage } from '@/types/change-request'

function ExternalIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  )
}

function ExternalLink({
  href,
  className,
  children,
}: {
  href: string
  className: string
  children: ReactNode
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <ExternalIcon />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

function Inline({ tokens }: { tokens: InlineToken[] }) {
  return tokens.map((token, index) => {
    if (token.type === 'text') return token.text
    if (token.type === 'code') return <code key={index}>{token.text}</code>
    return (
      <ExternalLink
        key={index}
        href={token.href}
        className={token.kind === 'url' ? 'cr-link' : 'cr-link-chip'}
      >
        {token.label}
      </ExternalLink>
    )
  })
}

function Blocks({ blocks }: { blocks: MessageBlock[] }) {
  return blocks.map((block, index) => {
    if (block.type === 'list') {
      const List = block.ordered ? 'ol' : 'ul'
      return (
        <List key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <Inline tokens={item} />
            </li>
          ))}
        </List>
      )
    }
    return (
      <p key={index}>
        {block.lines.map((line, lineIndex) => (
          <span key={lineIndex}>
            {lineIndex > 0 && <br />}
            <Inline tokens={line} />
          </span>
        ))}
      </p>
    )
  })
}

const EVENT_ICON_PATHS: Record<SystemEventKind, string[]> = {
  picked_up: ['M5 3l14 9-14 9V3z'],
  pr_opened: ['M6 3v12', 'M18 9a9 9 0 0 1-9 9', 'M18 3v6', 'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  pr_updated: ['M21 12a9 9 0 1 1-3-6.7L21 8', 'M21 3v5h-5'],
  ci_repair: [
    'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
  ],
  verified: ['M20 6 9 17l-5-5'],
  needs_review: [
    'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  needs_input: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  needs_attention: [
    'M12 9v4',
    'M12 17h.01',
    'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  ],
  revision_requested: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  requeued: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5'],
  merged: ['M6 3v18', 'M6 9a9 9 0 0 0 9 9h4', 'M17 14l4 4-4 4'],
  closed: ['M18 6 6 18', 'M6 6l12 12'],
  notice: ['M12 16v-4', 'M12 8h.01', 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z'],
}

function EventIcon({ kind }: { kind: SystemEventKind }) {
  return (
    <span className="cr-event-icon" aria-hidden="true">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {EVENT_ICON_PATHS[kind].map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  )
}

function Timestamp({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} className="admin-meta">
      {formatChangeRequestDateTime(iso)}
    </time>
  )
}

function SystemEventRow({
  message,
  context,
}: {
  message: ChangeRequestMessage
  context: ThreadContext
}) {
  const event = classifySystemEvent(message.body, context)
  const detail = event.detail ? parseMessageBlocks(event.detail, context) : []
  return (
    <li className="cr-event" data-tone={event.tone} data-event={event.kind}>
      <EventIcon kind={event.kind} />
      <div className="cr-event-main">
        <div className="cr-event-head">
          <span className="sr-only">Status update: </span>
          {event.title && <span className="cr-event-title">{event.title}</span>}
          <Timestamp iso={message.created_at} />
        </div>
        {detail.length > 0 && (
          <div className="cr-rich cr-event-detail">
            <Blocks blocks={detail} />
          </div>
        )}
        {event.actions.length > 0 && (
          <div className="cr-event-actions">
            {event.actions.map((action: SystemEventAction) => (
              <ExternalLink
                key={action.href}
                href={action.href}
                className="admin-button admin-button-quiet cr-event-action"
              >
                {action.label}
              </ExternalLink>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

function Avatar({ kind, name }: { kind: 'agent' | 'requester'; name: string }) {
  if (kind === 'agent') {
    return (
      <span className="cr-avatar" data-kind="agent" aria-hidden="true">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="8" width="16" height="12" rx="2" />
          <path d="M12 4v4" />
          <path d="M9 13h.01" />
          <path d="M15 13h.01" />
        </svg>
      </span>
    )
  }
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
  return (
    <span className="cr-avatar" data-kind="requester" aria-hidden="true">
      {initials || '?'}
    </span>
  )
}

/**
 * The request conversation as a timeline: agent and admin messages are chat
 * bubbles, status messages are compact event rows with PR/preview buttons.
 * Streamed in after the page header.
 */
export async function ChangeRequestThread({
  messages: messagesPromise,
  names: namesPromise,
  context,
}: {
  messages: Promise<ChangeRequestMessage[]>
  names: Promise<Map<string, string>>
  context: ThreadContext
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
    <ol className="cr-thread" aria-label="Request timeline" data-testid="change-request-thread">
      {messages.map((message) => {
        if (message.author_kind === 'system') {
          return <SystemEventRow key={message.id} message={message} context={context} />
        }
        const kind = message.author_kind
        const author =
          kind === 'agent'
            ? 'Website agent'
            : ((message.author_id && names.get(message.author_id)) ?? 'Admin')
        return (
          <li key={message.id} className="cr-message" data-kind={kind}>
            <Avatar kind={kind} name={author} />
            <div className="cr-bubble">
              <div className="cr-message-head">
                <span className="cr-message-author">{author}</span>
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
                <Timestamp iso={message.created_at} />
              </div>
              <div className="cr-rich cr-message-body">
                <Blocks blocks={parseMessageBlocks(message.body, context)} />
              </div>
            </div>
          </li>
        )
      })}
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
