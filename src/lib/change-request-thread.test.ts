import { describe, expect, it } from 'vitest'

import {
  classifySystemEvent,
  parseMessageBlocks,
  tokenizeInline,
  trimUrlMatch,
  type ThreadContext,
} from './change-request-thread'

const PR_URL = 'https://github.com/georgenijo/St-Basils-Rebuild/pull/351'
const PREVIEW = 'https://st-basils-git-change-request-abc.vercel.app'
const context: ThreadContext = { prUrl: PR_URL, prNumber: 351, previewUrl: PREVIEW }
const noPr: ThreadContext = { prUrl: null, prNumber: null, previewUrl: null }

describe('trimUrlMatch', () => {
  it('drops sentence punctuation and unbalanced closing parens', () => {
    expect(trimUrlMatch('https://example.org/a.')).toBe('https://example.org/a')
    expect(trimUrlMatch('https://example.org/a),')).toBe('https://example.org/a')
    expect(trimUrlMatch('https://en.wikipedia.org/wiki/Foo_(bar)')).toBe(
      'https://en.wikipedia.org/wiki/Foo_(bar)'
    )
  })
})

describe('tokenizeInline', () => {
  it('turns URLs into links, labelling PR and preview URLs', () => {
    expect(
      tokenizeInline(`See ${PR_URL}, then ${PREVIEW}/about. Or https://example.org/x`, context)
    ).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'link', href: PR_URL, label: 'PR #351', kind: 'pr' },
      { type: 'text', text: ', then ' },
      { type: 'link', href: `${PREVIEW}/about`, label: 'Open preview', kind: 'preview' },
      { type: 'text', text: '. Or ' },
      { type: 'link', href: 'https://example.org/x', label: 'example.org/x', kind: 'url' },
    ])
  })

  it('never links non-http schemes or markup', () => {
    const tokens = tokenizeInline(
      'javascript:alert(1) <a href="x">hi</a> data:text/html,1',
      context
    )
    expect(tokens).toEqual([
      { type: 'text', text: 'javascript:alert(1) <a href="x">hi</a> data:text/html,1' },
    ])
  })

  it('links PR mentions to the request repository only when it is known', () => {
    expect(tokenizeInline('Updated pull request #352 and PR #7.', context)).toEqual([
      { type: 'text', text: 'Updated pull request ' },
      {
        type: 'link',
        href: 'https://github.com/georgenijo/St-Basils-Rebuild/pull/352',
        label: '#352',
        kind: 'pr',
      },
      { type: 'text', text: ' and PR ' },
      {
        type: 'link',
        href: 'https://github.com/georgenijo/St-Basils-Rebuild/pull/7',
        label: '#7',
        kind: 'pr',
      },
      { type: 'text', text: '.' },
    ])
    expect(tokenizeInline('pull request #352', noPr)).toEqual([
      { type: 'text', text: 'pull request #352' },
    ])
  })

  it('keeps `code` spans literal', () => {
    expect(tokenizeInline('Edited `src/app/page.tsx` at https://x.org', context)).toEqual([
      { type: 'text', text: 'Edited ' },
      { type: 'code', text: 'src/app/page.tsx' },
      { type: 'text', text: ' at ' },
      { type: 'link', href: 'https://x.org/', label: 'x.org/', kind: 'url' },
    ])
  })
})

describe('parseMessageBlocks', () => {
  it('splits paragraphs, keeps line breaks, and builds lists', () => {
    const blocks = parseMessageBlocks(
      'Changed the footer.\nKept the layout.\n\n- one\n- two\n1. first\n2) second\n\nDone',
      noPr
    )
    expect(blocks).toEqual([
      {
        type: 'paragraph',
        lines: [
          [{ type: 'text', text: 'Changed the footer.' }],
          [{ type: 'text', text: 'Kept the layout.' }],
        ],
      },
      {
        type: 'list',
        ordered: false,
        items: [[{ type: 'text', text: 'one' }], [{ type: 'text', text: 'two' }]],
      },
      {
        type: 'list',
        ordered: true,
        items: [[{ type: 'text', text: 'first' }], [{ type: 'text', text: 'second' }]],
      },
      { type: 'paragraph', lines: [[{ type: 'text', text: 'Done' }]] },
    ])
  })
})

describe('classifySystemEvent', () => {
  it('recognises a newly opened pull request', () => {
    const event = classifySystemEvent(
      `Opened pull request #351: ${PR_URL}\nIt opens as a draft and is marked ready for review automatically once CI checks and the Vercel preview verification both pass.`,
      context
    )
    expect(event).toMatchObject({
      kind: 'pr_opened',
      title: 'PR #351 opened',
      actions: [{ label: 'View PR #351', href: PR_URL, kind: 'pr' }],
    })
    expect(event.detail).toMatch(/^It opens as a draft/)
  })

  it('recognises preview verification with a preview button', () => {
    expect(
      classifySystemEvent(
        `Preview verified (pass): The footer now reads "Contact the parish office".\nPreview: ${PREVIEW}/`,
        context
      )
    ).toEqual({
      kind: 'verified',
      tone: 'ok',
      title: 'Preview verified',
      detail: 'The footer now reads "Contact the parish office".',
      actions: [{ label: 'Open preview', href: `${PREVIEW}/`, kind: 'preview' }],
    })
    expect(
      classifySystemEvent(
        `Preview verification needs a human look (unsure, automated checks failed): Hard to tell.\nPreview: ${PREVIEW}`,
        context
      )
    ).toMatchObject({ kind: 'needs_review', tone: 'warn', title: 'Preview needs a human look' })
  })

  it.each([
    ['The worker picked up this request and is preparing a change.', 'picked_up', 'neutral'],
    [
      'Pushed a repair for the failing CI checks (commit abc1234); waiting on CI again.',
      'ci_repair',
      'neutral',
    ],
    [
      'The agent needs more information before making this change. Reply in the thread to send it back to the queue.',
      'needs_input',
      'warn',
    ],
    [
      'Pull request #351 is open but its CI checks failed even after one repair attempt, so it was left open for a human to fix.',
      'needs_attention',
      'warn',
    ],
    ['Pull request #351 was merged. Vercel deploys it to the live site shortly.', 'merged', 'ok'],
    ['Pull request #351 was closed without merging.', 'closed', 'neutral'],
    [
      'Requeued after a reply from Mary Thomas. The agent will pick it up again and re-read the whole thread.',
      'requeued',
      'neutral',
    ],
    [
      'The worker restarted while processing this request; it has been queued again.',
      'requeued',
      'neutral',
    ],
    [
      'The worker stopped before finishing this request and it has used all 3 attempts.',
      'needs_attention',
      'warn',
    ],
    ['The change was not submitted: touches a protected file', 'needs_attention', 'warn'],
    ['Something new the worker says', 'notice', 'neutral'],
  ])('classifies %j', (body, kind, tone) => {
    expect(classifySystemEvent(body, context)).toMatchObject({ kind, tone })
  })

  it('capitalises the remaining detail text', () => {
    expect(
      classifySystemEvent(
        'Pushed a repair for the failing CI checks (commit abc1234); waiting on CI again.',
        context
      )
    ).toMatchObject({ title: 'Pushed a CI fix (abc1234)', detail: 'Waiting on CI again.' })
  })

  it('keeps names with periods whole in requeue and revision events', () => {
    expect(
      classifySystemEvent(
        'Requeued after a reply from mary.thomas@example.org. The agent will pick it up again and re-read the whole thread.',
        context
      )
    ).toMatchObject({
      kind: 'requeued',
      title: 'Requeued after a reply from mary.thomas@example.org',
      detail: 'The agent will pick it up again and re-read the whole thread.',
    })
    expect(
      classifySystemEvent(
        'Changes requested by Dr. Mary Thomas. The agent will revise pull request #351 using the whole thread, then re-run the checks and verify the preview again.',
        context
      )
    ).toMatchObject({
      kind: 'revision_requested',
      title: 'Changes requested by Dr. Mary Thomas',
      detail: expect.stringMatching(/^The agent will revise pull request #351/),
    })
  })

  it('links PR events to the request repository', () => {
    expect(classifySystemEvent('Pull request #351 was merged.', context).actions).toEqual([
      { label: 'View PR #351', href: PR_URL, kind: 'pr' },
    ])
    expect(classifySystemEvent('Pull request #351 was merged.', noPr).actions).toEqual([])
  })

  it('keeps the full text of unrecognised notices', () => {
    expect(classifySystemEvent('  Hello\nworld ', context)).toEqual({
      kind: 'notice',
      tone: 'neutral',
      title: null,
      detail: 'Hello\nworld',
      actions: [],
    })
  })

  it('ignores an unsafe PR URL in an otherwise recognised event', () => {
    const event = classifySystemEvent('Opened pull request #9: javascript:alert(1)\nx', noPr)
    expect(event.actions).toEqual([])
  })
})
