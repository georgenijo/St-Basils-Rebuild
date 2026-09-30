import { describe, expect, it } from 'vitest'

import { evidenceCheck, hardChecksPass, type Recording } from './verify'
import type { VerificationCheck } from './types'

const FAKE_RECORDING: Recording = {
  label: 'after · desktop (recording)',
  file: 'after-desktop.webm',
  webm: Buffer.from('fake'),
}

const PASSING_HARD_CHECK: VerificationCheck = { name: 'preview responds (desktop)', ok: true }
const ADVISORY_FAILING_CHECK: VerificationCheck = {
  name: 'picked element visible on preview (desktop, advisory)',
  ok: false,
}

describe('evidenceCheck', () => {
  it('passes when a recording exists and its upload succeeded', () => {
    const check = evidenceCheck(FAKE_RECORDING, false)
    expect(check.ok).toBe(true)
    expect(check.name).not.toContain('advisory')
  })

  it('fails when no recording was produced (capture/read failure)', () => {
    const check = evidenceCheck(null, false)
    expect(check.ok).toBe(false)
    expect(check.name).not.toContain('advisory')
    expect(check.detail).toBeTruthy()
  })

  it('fails when the recording was captured but its upload failed', () => {
    const check = evidenceCheck(FAKE_RECORDING, true)
    expect(check.ok).toBe(false)
    expect(check.detail).toBeTruthy()
  })

  it('never puts raw error text in the (publicly posted) detail', () => {
    const missingCheck = evidenceCheck(null, false)
    const uploadFailedCheck = evidenceCheck(FAKE_RECORDING, true)
    for (const check of [missingCheck, uploadFailedCheck]) {
      expect(check.detail).not.toMatch(/Error:|TypeError|at Object\.|stack/i)
    }
  })
})

describe('hardChecksPass with the required-evidence check', () => {
  it('is required: a job.ts-style "passed" verdict is not reachable without it', () => {
    // Mirrors job.ts: `passed = verification.verdict === 'pass' && hardChecksPass(verification.checks)`.
    const checksWithMissingEvidence = [
      PASSING_HARD_CHECK,
      ADVISORY_FAILING_CHECK,
      evidenceCheck(null, false),
    ]
    expect(hardChecksPass(checksWithMissingEvidence)).toBe(false)

    const checksWithUploadFailure = [PASSING_HARD_CHECK, evidenceCheck(FAKE_RECORDING, true)]
    expect(hardChecksPass(checksWithUploadFailure)).toBe(false)

    const checksAllGood = [
      PASSING_HARD_CHECK,
      ADVISORY_FAILING_CHECK,
      evidenceCheck(FAKE_RECORDING, false),
    ]
    // Advisory failures alone still allow a pass; only non-advisory checks gate it.
    expect(hardChecksPass(checksAllGood)).toBe(true)
  })
})
