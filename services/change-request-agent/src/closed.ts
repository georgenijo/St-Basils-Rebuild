import { listClosedPendingCleanup, postMessageSafe, updateIfStatus, type Db } from './db'
import type { GitHub } from './github'
import { log } from './log'
import { branchName } from './naming'

/** Only branches the worker created are ever deleted. */
const WORKER_BRANCH = /^change-request\/[a-z0-9][a-z0-9-]*$/

/**
 * Requests an admin closed from the site (#361): close their still-open pull
 * request and delete the worker's branch, then clear the pending flag. Runs
 * in the maintenance sweep, so it is retried on the next run if GitHub is
 * unavailable. The public PR comment never includes the private reason.
 *
 * A failed first attempt can have pushed its branch or opened its PR without
 * recording them, so a missing branch falls back to the worker's
 * deterministic name and a missing PR to the open PR for that branch.
 * Nothing runs in a dry run: the flags stay set for a real worker.
 */
export async function cleanupClosedRequests(
  db: Db,
  gh: GitHub,
  options: { dryRun?: boolean } = {}
): Promise<void> {
  if (options.dryRun) return
  const rows = await listClosedPendingCleanup(db)
  for (const row of rows) {
    try {
      const branch = row.branch_name || branchName(row.id, 'website-update')
      let prNumber = row.pr_number
      if (!prNumber) {
        // Any state: a PR merged or closed before this sweep still decides the outcome.
        prNumber = (await gh.findLatestPullForBranch(branch))?.number ?? null
        // Remember it, so a retry after a later failure still sees the same PR.
        if (prNumber) await updateIfStatus(db, row.id, 'closed', { pr_number: prNumber })
      }
      let merged = false
      let closedPr = false
      if (prNumber) {
        const pr = await gh.pullState(prNumber)
        merged = pr.merged
        if (pr.state === 'open') {
          await gh.comment(
            prNumber,
            'Closed from the admin console: this website change request was withdrawn, so it will not be merged.'
          )
          try {
            await gh.closePull(prNumber)
          } finally {
            // Someone may have merged it meanwhile: the final state decides.
            const final = await gh.pullState(prNumber)
            merged = final.merged
            closedPr = final.state === 'closed' && !final.merged
          }
        }
      }
      let deletedBranch = false
      if (WORKER_BRANCH.test(branch)) {
        deletedBranch = await gh.deleteBranch(branch)
      }
      const done = await updateIfStatus(
        db,
        row.id,
        'closed',
        merged
          ? { status: 'merged', github_cleanup_pending: false }
          : { github_cleanup_pending: false }
      )
      if (!done) continue
      log.info('closed request cleaned up', {
        requestId: row.id,
        pr: prNumber,
        closedPr,
        deletedBranch,
        merged,
      })
      const parts: string[] = []
      if (merged) {
        parts.push(
          `Pull request #${prNumber} had already been merged before the request was closed, so the change was not withdrawn. Vercel deploys merged changes to the live site.`
        )
      } else if (closedPr) {
        parts.push(`Closed pull request #${prNumber}.`)
      } else if (prNumber) {
        parts.push(`Pull request #${prNumber} was already closed.`)
      }
      if (deletedBranch) parts.push(`Deleted branch ${branch}.`)
      if (parts.length > 0) await postMessageSafe(db, row.id, 'system', parts.join(' '))
    } catch (error) {
      log.warn('closed request cleanup failed; will retry', {
        requestId: row.id,
        pr: row.pr_number,
        error: String(error),
      })
    }
  }
}
