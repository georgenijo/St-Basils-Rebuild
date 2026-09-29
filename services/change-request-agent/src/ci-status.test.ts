import { describe, expect, it } from 'vitest'

import { selectCiConclusion, selectRequiredCiConclusion } from './ci-status'
import type { GithubCheckRun } from './github'

function run(overrides: Partial<GithubCheckRun>): GithubCheckRun {
  return {
    id: 1,
    name: 'Validate',
    status: 'completed',
    conclusion: 'success',
    html_url: 'https://github.com/x/y/runs/1',
    ...overrides,
  }
}

describe('selectCiConclusion', () => {
  it('is pending when no check run matches the configured name', () => {
    expect(selectCiConclusion([run({ name: 'Unit Tests' })], 'Validate')).toEqual({
      state: 'pending',
    })
  })

  it('is pending while the matching check run is still queued or in progress', () => {
    expect(
      selectCiConclusion([run({ status: 'in_progress', conclusion: null })], 'Validate')
    ).toEqual({ state: 'pending' })
  })

  it('is success on a completed run with conclusion success', () => {
    expect(selectCiConclusion([run({ id: 7 })], 'Validate')).toEqual({
      state: 'success',
      checkRunId: 7,
      htmlUrl: 'https://github.com/x/y/runs/1',
    })
  })

  it('rejects neutral and skipped conclusions', () => {
    expect(selectCiConclusion([run({ conclusion: 'neutral' })], 'Validate').state).toBe('failure')
    expect(selectCiConclusion([run({ conclusion: 'skipped' })], 'Validate').state).toBe('failure')
  })

  it('requires every always-on PR job, not just Validate', () => {
    const checks = [
      'Validate',
      'Unit Tests',
      'Change Request Agent Service',
      'Browser Flow Tests',
    ].map((name, index) => run({ name, id: index + 1 }))
    expect(selectRequiredCiConclusion(checks, 'Validate').state).toBe('success')
    expect(selectRequiredCiConclusion(checks.slice(0, 3), 'Validate').state).toBe('pending')
    expect(
      selectRequiredCiConclusion(
        [...checks, run({ id: 10, name: 'Unit Tests', conclusion: 'failure' })],
        'Validate'
      )
    ).toMatchObject({ state: 'failure', checkRunId: 10 })
    expect(
      selectRequiredCiConclusion(
        [
          ...checks,
          run({ id: 11, name: 'Browser Flow Tests', status: 'in_progress', conclusion: null }),
        ],
        'Validate'
      ).state
    ).toBe('pending')
  })

  it('is failure on a completed run with conclusion failure', () => {
    expect(selectCiConclusion([run({ id: 9, conclusion: 'failure' })], 'Validate')).toEqual({
      state: 'failure',
      checkRunId: 9,
      conclusion: 'failure',
      htmlUrl: 'https://github.com/x/y/runs/1',
    })
  })

  it('picks the highest id (most recent re-run) when the same check name repeats', () => {
    const runs = [run({ id: 1, conclusion: 'failure' }), run({ id: 2, conclusion: 'success' })]
    expect(selectCiConclusion(runs, 'Validate')).toMatchObject({ state: 'success', checkRunId: 2 })
  })

  it('ignores check runs for other names when picking the newest', () => {
    const runs = [
      run({ id: 5, name: 'Validate', conclusion: 'success' }),
      run({ id: 99, name: 'Unit Tests', conclusion: 'failure' }),
    ]
    expect(selectCiConclusion(runs, 'Validate')).toMatchObject({ state: 'success', checkRunId: 5 })
  })
})
