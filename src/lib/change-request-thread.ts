import { safeExternalUrl } from '@/lib/change-request-status'

/**
 * Turns plain-text request messages into safe, structured pieces for the
 * conversation timeline. Nothing here produces HTML: the thread component
 * renders these tokens as React elements, so message text is always escaped
 * and only http(s) URLs ever become links.
 */

export interface ThreadContext {
  prUrl: string | null
  prNumber: number | null
  previewUrl: string | null
}

export type LinkKind = 'pr' | 'preview' | 'url'

export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; label: string; kind: LinkKind }

export type MessageBlock =
  | { type: 'paragraph'; lines: InlineToken[][] }
  | { type: 'list'; ordered: boolean; items: InlineToken[][] }

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/gi
const PR_MENTION_PATTERN = /\b(pull request|PR) #(\d+)\b/gi
const GITHUB_PR_URL = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)(?:[/?#].*)?$/i
const TRAILING_PUNCTUATION = /[.,;:!?'"*_]$/

/** Drop sentence punctuation (and an unbalanced closing paren) from a URL match. */
export function trimUrlMatch(match: string): string {
  let url = match
  for (;;) {
    if (TRAILING_PUNCTUATION.test(url)) {
      url = url.slice(0, -1)
    } else if (url.endsWith(')') && count(url, '(') < count(url, ')')) {
      url = url.slice(0, -1)
    } else {
      return url
    }
  }
}

function count(text: string, char: string): number {
  return text.split(char).length - 1
}

/** `owner/repo` of the request's pull request, used to link bare `#N` mentions. */
function repoOf(prUrl: string | null): string | null {
  const match = prUrl ? GITHUB_PR_URL.exec(prUrl) : null
  return match ? match[1] : null
}

function sameOrigin(a: string, b: string | null): boolean {
  if (!b) return false
  try {
    return new URL(a).origin === new URL(b).origin
  } catch {
    return false
  }
}

/** Classify and label a URL that appeared in a message. */
export function describeUrl(
  href: string,
  context: ThreadContext
): { label: string; kind: LinkKind } {
  const pr = GITHUB_PR_URL.exec(href)
  if (pr) return { label: `PR #${pr[2]}`, kind: 'pr' }
  if (sameOrigin(href, context.previewUrl)) return { label: 'Open preview', kind: 'preview' }
  return { label: href.replace(/^https?:\/\//i, ''), kind: 'url' }
}

function pushText(tokens: InlineToken[], text: string) {
  if (!text) return
  const last = tokens.at(-1)
  if (last?.type === 'text') last.text += text
  else tokens.push({ type: 'text', text })
}

/** Link `pull request #N` / `PR #N` mentions to the request's repository. */
function tokenizeMentions(text: string, context: ThreadContext, tokens: InlineToken[]) {
  const repo = repoOf(context.prUrl)
  if (!repo) return pushText(tokens, text)
  let cursor = 0
  for (const match of text.matchAll(PR_MENTION_PATTERN)) {
    const hashIndex = match.index + match[1].length + 1
    pushText(tokens, text.slice(cursor, hashIndex))
    tokens.push({
      type: 'link',
      href: `https://github.com/${repo}/pull/${match[2]}`,
      label: `#${match[2]}`,
      kind: 'pr',
    })
    cursor = match.index + match[0].length
  }
  pushText(tokens, text.slice(cursor))
}

function tokenizeLinks(text: string, context: ThreadContext, tokens: InlineToken[]) {
  let cursor = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = trimUrlMatch(match[0])
    const href = safeExternalUrl(raw)
    if (!href) continue
    tokenizeMentions(text.slice(cursor, match.index), context, tokens)
    tokens.push({ type: 'link', href, ...describeUrl(href, context) })
    cursor = match.index + raw.length
  }
  tokenizeMentions(text.slice(cursor), context, tokens)
}

/** Split one line into text, `code` spans and links. */
export function tokenizeInline(text: string, context: ThreadContext): InlineToken[] {
  const tokens: InlineToken[] = []
  const parts = text.split(/(`[^`\n]+`)/)
  for (const part of parts) {
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      tokens.push({ type: 'code', text: part.slice(1, -1) })
    } else {
      tokenizeLinks(part, context, tokens)
    }
  }
  return tokens
}

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.*)$/

/** Paragraphs (blank-line separated, line breaks kept) and simple lists. */
export function parseMessageBlocks(body: string, context: ThreadContext): MessageBlock[] {
  const blocks: MessageBlock[] = []
  let current: MessageBlock | null = null

  for (const line of body.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) {
      current = null
      continue
    }
    const bullet = BULLET.exec(line)
    const numbered = bullet ? null : NUMBERED.exec(line)
    if (bullet || numbered) {
      const ordered = Boolean(numbered)
      const item = tokenizeInline((bullet ?? numbered)![1], context)
      if (current?.type === 'list' && current.ordered === ordered) {
        current.items.push(item)
      } else {
        current = { type: 'list', ordered, items: [item] }
        blocks.push(current)
      }
      continue
    }
    const tokens = tokenizeInline(line.trim(), context)
    if (current?.type === 'paragraph') {
      current.lines.push(tokens)
    } else {
      current = { type: 'paragraph', lines: [tokens] }
      blocks.push(current)
    }
  }
  return blocks
}

export type SystemEventKind =
  | 'picked_up'
  | 'pr_opened'
  | 'pr_updated'
  | 'ci_repair'
  | 'verified'
  | 'needs_review'
  | 'needs_input'
  | 'needs_attention'
  | 'requeued'
  | 'revision_requested'
  | 'merged'
  | 'closed'
  | 'notice'

export type SystemEventTone = 'ok' | 'warn' | 'neutral'

export interface SystemEventAction {
  label: string
  href: string
  kind: LinkKind
}

export interface SystemEvent {
  kind: SystemEventKind
  tone: SystemEventTone
  /** Short headline; null for unrecognised notices, which show their full text. */
  title: string | null
  /** Remaining text (rendered as message blocks), if any. */
  detail: string | null
  actions: SystemEventAction[]
}

function prAction(number: string, url: string | null, context: ThreadContext) {
  const repo = repoOf(context.prUrl)
  const href = safeExternalUrl(url) ?? (repo ? `https://github.com/${repo}/pull/${number}` : null)
  return href ? [{ label: `View PR #${number}`, href, kind: 'pr' as const }] : []
}

function previewAction(url: string) {
  const href = safeExternalUrl(trimUrlMatch(url))
  return href ? [{ label: 'Open preview', href, kind: 'preview' as const }] : []
}

function clean(text: string | undefined): string | null {
  const trimmed = text?.trim()
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : null
}

/**
 * Recognise the status messages the website agent and the site post (see
 * services/change-request-agent/src/job.ts and src/actions/change-requests.ts)
 * so they render as compact timeline rows. Anything unrecognised falls back
 * to a plain notice showing its full text, so no information is ever hidden.
 */
export function classifySystemEvent(body: string, context: ThreadContext): SystemEvent {
  const text = body.replace(/\r\n?/g, '\n').trim()
  let match: RegExpExecArray | null

  if (/^The worker picked up this request/.test(text)) {
    return {
      kind: 'picked_up',
      tone: 'neutral',
      title: 'Picked up by the website agent',
      detail: null,
      actions: [],
    }
  }
  if ((match = /^(Opened|Updated) pull request #(\d+): (\S+)\s*([\s\S]*)$/.exec(text))) {
    const opened = match[1] === 'Opened'
    return {
      kind: opened ? 'pr_opened' : 'pr_updated',
      tone: 'neutral',
      title: `PR #${match[2]} ${opened ? 'opened' : 'updated'}`,
      detail: clean(match[4]),
      actions: prAction(match[2], trimUrlMatch(match[3]), context),
    }
  }
  if (
    (match = /^Pushed a repair for the failing CI checks \(commit (\w+)\);?\s*([\s\S]*)$/.exec(
      text
    ))
  ) {
    return {
      kind: 'ci_repair',
      tone: 'neutral',
      title: `Pushed a CI fix (${match[1]})`,
      detail: clean(match[2]),
      actions: [],
    }
  }
  if ((match = /^Preview verified \([^)]*\):\s*([\s\S]*?)\s*\nPreview: (\S+)\s*$/.exec(text))) {
    return {
      kind: 'verified',
      tone: 'ok',
      title: 'Preview verified',
      detail: clean(match[1]),
      actions: previewAction(match[2]),
    }
  }
  if (
    (match =
      /^Preview verification needs a human look \(([^)]*)\):\s*([\s\S]*?)\s*\nPreview: (\S+)\s*$/.exec(
        text
      ))
  ) {
    return {
      kind: 'needs_review',
      tone: 'warn',
      title: 'Preview needs a human look',
      detail: clean(`${match[2]}\n\nVerdict: ${match[1]}`),
      actions: previewAction(match[3]),
    }
  }
  if ((match = /^Pull request #(\d+) was merged\.\s*([\s\S]*)$/.exec(text))) {
    return {
      kind: 'merged',
      tone: 'ok',
      title: `PR #${match[1]} merged`,
      detail: clean(match[2]),
      actions: prAction(match[1], null, context),
    }
  }
  if ((match = /^Pull request #(\d+) was closed without merging\.\s*([\s\S]*)$/.exec(text))) {
    return {
      kind: 'closed',
      tone: 'neutral',
      title: `PR #${match[1]} closed without merging`,
      detail: clean(match[2]),
      actions: prAction(match[1], null, context),
    }
  }
  // Split at the known follow-up sentence so names with periods (emails,
  // "Dr. Mary Thomas") stay whole.
  if ((match = /^Changes requested by ([^\n]+?)\.\s+(The agent will revise[\s\S]*)$/.exec(text))) {
    return {
      kind: 'revision_requested',
      tone: 'neutral',
      title: `Changes requested by ${match[1]}`,
      detail: clean(match[2]),
      actions: [],
    }
  }
  if (
    (match = /^Requeued after a reply from ([^\n]+?)\.(?:\s+(The agent will[\s\S]*))?$/.exec(text))
  ) {
    return {
      kind: 'requeued',
      tone: 'neutral',
      title: `Requeued after a reply from ${match[1]}`,
      detail: clean(match[2]),
      actions: [],
    }
  }
  if ((match = /^The worker (restarted|stopped) [^;]*; it has been queued again\./.exec(text))) {
    return {
      kind: 'requeued',
      tone: 'neutral',
      title: `Queued again after the worker ${match[1]}`,
      detail: null,
      actions: [],
    }
  }
  if (/^The agent needs more information/.test(text)) {
    return {
      kind: 'needs_input',
      tone: 'warn',
      title: 'Needs your input',
      detail: text,
      actions: [],
    }
  }
  if ((match = /^Pull request #(\d+) is open but/.exec(text))) {
    return {
      kind: 'needs_attention',
      tone: 'warn',
      title: 'Needs attention',
      detail: text,
      actions: prAction(match[1], null, context),
    }
  }
  if (
    /^(The worker (hit an error|restarted|stopped)|The (formatted )?change was not submitted|The pull request is open but|The request is saved, but the agent launch|Dry run:)/.test(
      text
    )
  ) {
    return {
      kind: 'needs_attention',
      tone: 'warn',
      title: 'Needs attention',
      detail: text,
      actions: [],
    }
  }
  return { kind: 'notice', tone: 'neutral', title: null, detail: text, actions: [] }
}
