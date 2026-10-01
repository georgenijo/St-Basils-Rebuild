import {
  listByStatus,
  postMessageSafe,
  recordMerge,
  releaseMerge,
  updateIfStatus,
  type Db,
} from './db'
import type { GitHub } from './github'
import { log } from './log'
import type { ChangeRequest } from './types'

/** How long a site-side Approve & merge may take before an unmerged reservation is released. */
export const MERGE_CONFIRM_GRACE_MS = 10 * 60_000
const MERGE_CONFIRM_GRACE = '10 minutes'

async function markClosed(db: Db, row: ChangeRequest, from: ChangeRequest['status']) {
  if (await updateIfStatus(db, row.id, from, { status: 'closed', error: null })) {
    log.info('pull request state synced', {
      requestId: row.id,
      pr: row.pr_number,
      status: 'closed',
    })
    await postMessageSafe(
      db,
      row.id,
      'system',
      `Pull request #${row.pr_number} was closed without merging.`
    )
  }
}

/**
 * Bring requests in line with their pull requests on GitHub: record merges
 * (status, merge commit and thread entry, via record_change_request_merge),
 * mark PRs closed without merging as closed, and finish or release Approve &
 * merge reservations (`merging`) whose outcome the site could not record.
 */
export async function syncPullRequests(db: Db, gh: GitHub, now = new Date()): Promise<void> {
  const rows = await listByStatus(db, ['ready_for_review', 'needs_attention', 'merging'])
  for (const row of rows) {
    if (!row.pr_number) continue
    try {
      const pr = await gh.pullState(row.pr_number)
      if (pr.merged && pr.mergeCommitSha) {
        if (await recordMerge(db, row.id, pr.mergeCommitSha, pr.headSha)) {
          log.info('pull request state synced', {
            requestId: row.id,
            pr: row.pr_number,
            status: 'merged',
          })
        }
        continue
      }
      if (pr.state === 'closed' && !pr.merged) {
        if (row.status === 'merging') {
          if (!row.approval_id) continue
          const released = await releaseMerge(
            db,
            row.id,
            row.approval_id,
            `Pull request #${row.pr_number} was closed on GitHub before the approved merge completed.`
          )
          if (released) await markClosed(db, row, 'ready_for_review')
        } else {
          await markClosed(db, row, row.status)
        }
        continue
      }
      const approvedAt = row.approved_at ? Date.parse(row.approved_at) : 0
      if (
        row.status === 'merging' &&
        row.approval_id &&
        pr.state === 'open' &&
        now.getTime() - approvedAt > MERGE_CONFIRM_GRACE_MS
      ) {
        // The database re-checks that this exact reservation is still old
        // enough, so a concurrent sweep can never release a newer approval.
        const released = await releaseMerge(
          db,
          row.id,
          row.approval_id,
          'The approved merge was not confirmed on GitHub, so the request is ready for review again. Approve it again if it is still wanted.',
          MERGE_CONFIRM_GRACE
        )
        if (released) {
          log.warn('released unconfirmed merge', { requestId: row.id, pr: row.pr_number })
        }
      }
    } catch (error) {
      log.warn('pull request sync failed', {
        requestId: row.id,
        pr: row.pr_number,
        error: String(error),
      })
    }
  }
}
