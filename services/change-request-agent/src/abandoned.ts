/**
 * Recovery of abandoned submissions. The admin UI inserts a request as
 * `submitting`, uploads attachments, then flips it to `queued`. If the browser
 * or server action dies in between (text-only submissions never trigger the
 * web-side sweep), the row and any uploaded objects are left behind. The
 * worker deletes them after `maxAgeMs`, from its maintenance loop.
 */

export interface AbandonedDeps {
  /** Ids of `submitting` requests created before `cutoffIso`. */
  listStale(cutoffIso: string): Promise<string[]>
  /** Every Storage object path under `requests/<id>/`. Throws on error. */
  listObjects(requestId: string): Promise<string[]>
  /** storage_path of every change_request_files row. Throws on error. */
  fileRowPaths(requestId: string): Promise<string[]>
  removeObjects(paths: string[]): Promise<void>
  /** Delete the row only while still `submitting`; true when a row was deleted. */
  deleteIfSubmitting(requestId: string): Promise<boolean>
}

export interface AbandonedResult {
  found: number
  deleted: number
  skipped: number
  objectsRemoved: number
}

export const ABANDONED_MAX_AGE_MS = 60 * 60_000

export async function cleanupAbandonedSubmissions(
  deps: AbandonedDeps,
  now: Date,
  maxAgeMs = ABANDONED_MAX_AGE_MS,
  onSkip: (requestId: string, error: unknown) => void = () => {}
): Promise<AbandonedResult> {
  const ids = await deps.listStale(new Date(now.getTime() - maxAgeMs).toISOString())
  const result: AbandonedResult = { found: ids.length, deleted: 0, skipped: 0, objectsRemoved: 0 }
  for (const id of ids) {
    try {
      // Either lookup failing means we cannot be sure we would remove every
      // object; leave the row so the next cycle retries.
      const [objects, rows] = await Promise.all([deps.listObjects(id), deps.fileRowPaths(id)])
      const paths = [...new Set([...objects, ...rows])]
      if (paths.length > 0) {
        await deps.removeObjects(paths)
        result.objectsRemoved += paths.length
      }
      if (await deps.deleteIfSubmitting(id)) result.deleted++
    } catch (error) {
      result.skipped++
      onSkip(id, error)
    }
  }
  return result
}
