import { describe, expect, it } from 'vitest'

import { buildPrBody, buildVerdictComment, codeFence } from './prbody'
import type { ChangeRequest } from './types'

const request = {
  id: '3f2a9c1e-1234-4abc-9def-0123456789ab',
  requester_id: 'requester-uuid',
  title: 'Update flyer',
  description: 'PRIVATE: call Mary at 617-555-0123 or mary@example.com about the flyer',
  page_path: '/',
  target_selector: 'img',
} as ChangeRequest

describe('buildPrBody', () => {
  const body = buildPrBody({
    request,
    siteUrl: 'https://stbasilsboston.org',
    agentSummary: 'Updated the flyer alt text. Contact mary@example.com or (617) 555-0123.',
    changedFiles: ['src/components/features/FeastFlyer.tsx'],
    changedLines: 4,
    attachmentNames: ['flyer.jpg'],
    checksRan: ['lint', 'typecheck'],
    repaired: false,
    secrets: [],
  })

  it('includes the admin link, page, selector, summary, files and checks', () => {
    expect(body).toContain('`3f2a9c1e`')
    expect(body).toContain(`https://stbasilsboston.org/admin/requests/${request.id}`)
    expect(body).toContain('**Page:** `/`')
    expect(body).toContain('**Target element:** `img`')
    expect(body).toContain('Updated the flyer alt text.')
    expect(body).toContain('`npm run lint` passed')
    expect(body).toContain('src/components/features/FeastFlyer.tsx')
    expect(body).toContain('flyer.jpg')
    expect(body).toContain(`Submitted via /admin/requests (request ${request.id})`)
  })

  it('never includes the private description, requester identity, or contact details', () => {
    expect(body).not.toContain('PRIVATE')
    expect(body).not.toContain('Mary')
    expect(body).not.toContain('requester-uuid')
    expect(body).not.toContain('mary@example.com')
    expect(body).not.toContain('555-0123')
    expect(body).toContain('[redacted]')
  })
})

describe('buildVerdictComment', () => {
  it('includes verdict, commit and checks', () => {
    const comment = buildVerdictComment(
      {
        verdict: 'pass',
        summary: 'Looks right.',
        checks: [{ name: 'preview responds (desktop)', ok: true, detail: 'HTTP 200' }],
        commit_sha: 'abcdef1234567890',
      },
      'https://x.vercel.app'
    )
    expect(comment).toContain('PASS')
    expect(comment).toContain('commit abcdef1')
    expect(comment).toContain('- [x] preview responds (desktop) — HTTP 200')
  })
})

describe('codeFence', () => {
  it('uses a fence longer than any backtick run', () => {
    expect(codeFence('a ````` b')).toMatch(/^``````text\n/)
  })
})
