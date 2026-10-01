import { describe, expect, it } from 'vitest'

import { buildPrBody, buildVerdictComment, codeFence } from './prbody'
import type { ChangeRequest } from './types'

const request = {
  id: '3f2a9c1e-1234-4abc-9def-0123456789ab',
  requester_id: 'requester-uuid',
  title: 'Private title',
  description: 'PRIVATE: call Mary at 617-555-0123 or mary@example.com about the flyer',
  page_path: '/private-page',
  target_selector: '#private-selector',
} as ChangeRequest

describe('buildPrBody', () => {
  const body = buildPrBody({
    request,
    siteUrl: 'https://stbasilsboston.org',
    agentSummary: 'PRIVATE_SUMMARY: internal discussion without any contact pattern.',
    changedFiles: ['src/components/features/FeastFlyer.tsx'],
    changedLines: 4,
    attachmentNames: ['private-attachment.jpg'],
    secrets: [],
  })

  it('includes the authenticated admin link, public changed files and fixed checks', () => {
    expect(body).toContain('`3f2a9c1e`')
    expect(body).toContain(`https://stbasilsboston.org/admin/requests/${request.id}`)
    expect(body).toContain('All required CI jobs passed on this exact commit')
    expect(body).toContain('src/components/features/FeastFlyer.tsx')
  })

  it('omits all private metadata and generated prose, not just contact patterns', () => {
    for (const value of [
      'PRIVATE',
      'Mary',
      'requester-uuid',
      'mary@example.com',
      '555-0123',
      request.title,
      request.page_path,
      request.target_selector!,
      'private-attachment.jpg',
    ]) {
      expect(body).not.toContain(value)
    }
  })
})

describe('buildVerdictComment', () => {
  it('publishes only verdict, preview, commit and the private admin link', () => {
    const comment = buildVerdictComment(
      {
        verdict: 'pass',
        summary: 'Private generated verification details.',
        checks: [{ name: 'Private check name', ok: true, detail: 'Private browser output' }],
        commit_sha: 'abcdef1234567890',
      },
      'https://x.vercel.app',
      `https://stbasilsboston.org/admin/requests/${request.id}`
    )
    expect(comment).toContain('PASS')
    expect(comment).toContain('commit abcdef1')
    expect(comment).toContain(`/admin/requests/${request.id}`)
    expect(comment).not.toContain('Private generated')
    expect(comment).not.toContain('Private check')
    expect(comment).not.toContain('Private browser')
  })
})

describe('codeFence', () => {
  it('uses a fence longer than any backtick run', () => {
    expect(codeFence('a ````` b')).toMatch(/^``````text\n/)
  })
})
