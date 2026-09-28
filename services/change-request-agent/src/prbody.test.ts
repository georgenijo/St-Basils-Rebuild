import { describe, expect, it } from 'vitest'

import { buildPrBody, codeFence } from './prbody'
import type { ChangeRequest } from './types'

const request = {
  id: '3f2a9c1e-1234-4abc-9def-0123456789ab',
  requester_id: 'requester-uuid',
  title: 'Update flyer',
  description: 'Ping @someone and close #12 ```oops```',
  page_path: '/',
  target_selector: 'img',
} as ChangeRequest

describe('buildPrBody', () => {
  const body = buildPrBody({
    request,
    agentSummary: 'Updated the flyer alt text.',
    changedFiles: ['src/components/features/FeastFlyer.tsx'],
    changedLines: 4,
    attachmentNames: ['flyer.jpg'],
    checksRan: ['lint', 'typecheck'],
    repaired: false,
  })

  it('includes request fields, summary, checks and the provenance line', () => {
    expect(body).toContain('Update flyer')
    expect(body).toContain('`/`')
    expect(body).toContain('Updated the flyer alt text.')
    expect(body).toContain('`npm run lint` passed')
    expect(body).toContain('flyer.jpg')
    expect(body).toContain(`Submitted via /admin/requests (request ${request.id})`)
  })

  it('never includes the requester identity', () => {
    expect(body).not.toContain('requester-uuid')
  })

  it('fences the description so mentions and backticks stay inert', () => {
    expect(body).toContain('````text\nPing @someone')
  })
})

describe('codeFence', () => {
  it('uses a fence longer than any backtick run', () => {
    expect(codeFence('a ````` b')).toMatch(/^``````text\n/)
  })
})
