/**
 * Cleanup of abandoned submissions and orphaned Storage folders, run from the
 * worker's maintenance loop.
 *
 * The admin UI inserts a request as `submitting`, uploads attachments to
 * `requests/<id>/…`, then flips it to `queued`. If that is interrupted, the
 * row (and possibly objects) are left behind.
 *
 * One mechanism, two steps:
 * 1. Stale `submitting` rows are deleted first, conditionally on still being
 *    `submitting`; only when the delete returned the row are its objects
 *    removed. A request flipped to `queued` in between keeps its attachments.
 * 2. The orphan sweep removes objects under `requests/<uuid>/` folders that
 *    have no `change_requests` row, once the objects are older than a
 *    threshold. It catches failed removals from step 1 and the web action's
 *    rollback when the row delete succeeded but its response was lost.
 */

export interface StoredObject {
  path: string
  /** ISO timestamp; null when Storage did not report one. */
  createdAt: string | null
}

export interface CleanupDeps {
  /** Ids of `submitting` requests created before `cutoffIso`. */
  listStale(cutoffIso: string): Promise<string[]>
  /** Delete the row only while still `submitting`; true when a row came back. */
  deleteIfSubmitting(requestId: string): Promise<boolean>
  /** Every object under `prefix`, recursively. Throws on error. */
  listObjects(prefix: string): Promise<StoredObject[]>
  removeObjects(paths: string[]): Promise<void>
  /** One page of top-level folder names under `requests/`. Throws on error. */
  listRequestFolders(offset: number, limit: number): Promise<string[]>
  /** Which of `ids` have a change_requests row. Throws on error. */
  existingRequestIds(ids: string[]): Promise<Set<string>>
}

export const ABANDONED_MAX_AGE_MS = 60 * 60_000
export const ORPHAN_MIN_AGE_MS = 30 * 60_000
export const ORPHAN_MAX_FOLDERS_PER_CYCLE = 50
const FOLDER_PAGE = 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Logger = (msg: string, fields: Record<string, unknown>) => void
const noop: Logger = () => {}

export interface AbandonedResult {
  found: number
  deleted: number
  objectsRemoved: number
  /** Rows deleted whose objects could not be removed (left to the orphan sweep). */
  objectRemovalFailed: number
}

export async function cleanupAbandonedSubmissions(
  deps: CleanupDeps,
  now: Date,
  maxAgeMs = ABANDONED_MAX_AGE_MS,
  warn: Logger = noop
): Promise<AbandonedResult> {
  const ids = await deps.listStale(new Date(now.getTime() - maxAgeMs).toISOString())
  const result: AbandonedResult = {
    found: ids.length,
    deleted: 0,
    objectsRemoved: 0,
    objectRemovalFailed: 0,
  }
  for (const id of ids) {
    let deleted: boolean
    try {
      deleted = await deps.deleteIfSubmitting(id)
    } catch (error) {
      warn('abandoned submission delete failed; retrying next cycle', {
        requestId: id,
        error: String(error),
      })
      continue
    }
    if (!deleted) continue // queued (or gone) meanwhile: leave its files alone
    result.deleted++
    try {
      const objects = await deps.listObjects(`requests/${id}`)
      if (objects.length > 0) {
        await deps.removeObjects(objects.map((o) => o.path))
        result.objectsRemoved += objects.length
      }
    } catch (error) {
      result.objectRemovalFailed++
      warn('abandoned submission objects not removed; orphan sweep will retry', {
        requestId: id,
        error: String(error),
      })
    }
  }
  return result
}

export interface OrphanSweepResult {
  foldersScanned: number
  orphanFolders: number
  foldersProcessed: number
  foldersSkipped: number
  /** Orphans skipped because a request row appeared before removal. */
  foldersClaimed: number
  objectsRemoved: number
  objectsTooYoung: number
  /** Listing offset the next cycle starts from. */
  nextCursor: number
}

/**
 * In-memory rotation state kept by the worker between cycles, so folders
 * that can never be cleaned (unknown-age objects, repeated errors) cannot
 * starve later orphans of the per-cycle cap.
 */
export interface SweepState {
  cursor: number
}

export interface SweepOptions {
  minAgeMs?: number
  maxFolders?: number
  pageSize?: number
  state?: SweepState
  warn?: Logger
}

export async function sweepOrphanFolders(
  deps: CleanupDeps,
  now: Date,
  options: SweepOptions = {}
): Promise<OrphanSweepResult> {
  const minAgeMs = options.minAgeMs ?? ORPHAN_MIN_AGE_MS
  const maxFolders = options.maxFolders ?? ORPHAN_MAX_FOLDERS_PER_CYCLE
  const pageSize = options.pageSize ?? FOLDER_PAGE
  const state = options.state ?? { cursor: 0 }
  const warn = options.warn ?? noop
  const result: OrphanSweepResult = {
    foldersScanned: 0,
    orphanFolders: 0,
    foldersProcessed: 0,
    foldersSkipped: 0,
    foldersClaimed: 0,
    objectsRemoved: 0,
    objectsTooYoung: 0,
    nextCursor: 0,
  }
  const cutoff = now.getTime() - minAgeMs

  // Collect up to maxFolders orphans starting at the cursor. The cursor then
  // moves just past the last folder examined, or back to 0 at the end of the
  // listing, so every folder is reached within a bounded number of cycles.
  const orphans: string[] = []
  let offset = state.cursor
  let nextCursor = 0
  let restarted = false
  collect: for (;;) {
    const page = await deps.listRequestFolders(offset, pageSize)
    if (
      page.length === 0 &&
      offset > 0 &&
      !restarted &&
      state.cursor > 0 &&
      offset === state.cursor
    ) {
      // Cursor points past the end (folders were deleted): start over.
      offset = 0
      restarted = true
      continue
    }
    result.foldersScanned += page.length
    const candidates = page
      .map((name, index) => ({ name, position: offset + index }))
      .filter((c) => UUID.test(c.name))
    for (let i = 0; i < candidates.length; i += 100) {
      const chunk = candidates.slice(i, i + 100)
      let live: Set<string>
      try {
        live = await deps.existingRequestIds(chunk.map((c) => c.name))
      } catch (error) {
        result.foldersSkipped += chunk.length
        warn('orphan sweep row lookup failed; skipping folders', { error: String(error) })
        continue
      }
      for (const c of chunk) {
        if (live.has(c.name)) continue
        orphans.push(c.name)
        if (orphans.length >= maxFolders) {
          nextCursor = c.position + 1
          break collect
        }
      }
    }
    if (page.length < pageSize) {
      nextCursor = 0
      break
    }
    offset += pageSize
  }
  state.cursor = nextCursor
  result.nextCursor = nextCursor
  result.orphanFolders = orphans.length

  for (const id of orphans) {
    try {
      const objects = await deps.listObjects(`requests/${id}`)
      const old = objects.filter((o) => o.createdAt !== null && Date.parse(o.createdAt) <= cutoff)
      result.objectsTooYoung += objects.length - old.length
      if (old.length > 0) {
        // Ownership re-check right before deleting: a request row may have
        // been created for this id since the lookup above.
        let owned: Set<string>
        try {
          owned = await deps.existingRequestIds([id])
        } catch (error) {
          result.foldersSkipped++
          warn('orphan ownership re-check failed; skipping folder', {
            folder: id,
            error: String(error),
          })
          continue
        }
        if (owned.has(id)) {
          result.foldersClaimed++
          continue
        }
        await deps.removeObjects(old.map((o) => o.path))
        result.objectsRemoved += old.length
      }
      result.foldersProcessed++
    } catch (error) {
      result.foldersSkipped++
      warn('orphan folder skipped; retrying next cycle', { folder: id, error: String(error) })
    }
  }
  return result
}
