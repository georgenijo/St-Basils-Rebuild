import type { GithubCheckRun } from './github'

export type CiSelection =
  | { state: 'pending' }
  | { state: 'success'; checkRunId: number; htmlUrl: string | null }
  | { state: 'failure'; checkRunId: number; conclusion: string; htmlUrl: string | null }

/** The newest attempt must actually succeed; skipped/neutral are not proof. */
export function selectCiConclusion(checkRuns: GithubCheckRun[], checkName: string): CiSelection {
  const matching = checkRuns.filter((run) => run.name === checkName)
  if (matching.length === 0) return { state: 'pending' }
  const newest = matching.reduce((a, b) => (b.id > a.id ? b : a))
  if (newest.status !== 'completed') return { state: 'pending' }
  if (newest.conclusion === 'success') {
    return { state: 'success', checkRunId: newest.id, htmlUrl: newest.html_url }
  }
  return {
    state: 'failure',
    checkRunId: newest.id,
    conclusion: newest.conclusion ?? 'unknown',
    htmlUrl: newest.html_url,
  }
}

/** All always-on PR jobs in .github/workflows/ci.yml gate readiness. */
export function selectRequiredCiConclusion(
  checkRuns: GithubCheckRun[],
  validateCheckName: string
): CiSelection {
  const selections = [
    validateCheckName,
    'Unit Tests',
    'Change Request Agent Service',
    'Browser Flow Tests',
  ].map((name) => selectCiConclusion(checkRuns, name))
  const failed = selections.find((selection) => selection.state === 'failure')
  if (failed) return failed
  if (selections.some((selection) => selection.state === 'pending')) return { state: 'pending' }
  return selections[0]
}
