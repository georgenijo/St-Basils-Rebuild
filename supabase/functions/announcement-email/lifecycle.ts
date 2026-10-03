// This module has no runtime/global dependencies so the production lifecycle
// can be exercised with a synthetic database and fake provider in Vitest.
export interface Announcement {
  id: string
  title: string
  slug: string
  body: { type: string; [key: string]: unknown } | null
  send_email: boolean
  email_sent_at: string | null
  published_at: string | null
}

export interface Subscriber {
  email: string
  name: string | null
  unsubscribe_token: string
}

export type Claim =
  | { outcome: 'claimed'; record: Announcement }
  | { outcome: 'already_sent' | 'ineligible' | 'blocked' }

export interface BroadcastStore {
  getAnnouncement(id: string): Promise<Announcement>
  getSubscribers(): Promise<Subscriber[]>
  claim(id: string, attempt: string, total: number): Promise<Claim>
  progress(id: string, attempt: string, accepted: number): Promise<void>
  complete(id: string, attempt: string): Promise<void>
  reconcile(id: string, attempt: string): Promise<void>
}

export interface BroadcastResult {
  status: number
  body: Record<string, unknown>
}

const result = (status: number, body: Record<string, unknown>): BroadcastResult => ({
  status,
  body,
})

/**
 * A durable claim is never automatically reclaimed. Once claimed, a timeout,
 * crash, partial send, or persistence failure requires operator reconciliation.
 * Provider acceptance is not evidence of delivery, and this is not exactly once.
 */
export async function broadcast(
  id: string,
  attempt: string,
  store: BroadcastStore,
  send: (record: Announcement, subscribers: Subscriber[]) => Promise<void>
): Promise<BroadcastResult> {
  let claimed = false
  let accepted = 0
  let total = 0
  try {
    const fresh = await store.getAnnouncement(id)
    if (fresh.email_sent_at) return result(200, { skipped: true, reason: 'Already sent' })
    if (!fresh.send_email || !fresh.published_at) {
      return result(200, { skipped: true, reason: 'Conditions not met for sending' })
    }

    // All fallible preparation happens before claiming. Failure here is safe
    // to retry; no provider call has happened.
    const subscribers = await store.getSubscribers()
    total = subscribers.length
    const claim = await store.claim(id, attempt, total)
    if (claim.outcome === 'blocked') {
      return result(409, { error: 'Broadcast already claimed', needsReconciliation: true })
    }
    if (claim.outcome !== 'claimed') {
      return result(200, { skipped: true, reason: claim.outcome })
    }
    claimed = true

    // Stop at the first failure. Never automatically replay successful or
    // uncertain batches (including a partial mock batch).
    for (let offset = 0; offset < total; offset += 100) {
      const batch = subscribers.slice(offset, offset + 100)
      await send(claim.record, batch)
      accepted += batch.length
      await store.progress(id, attempt, accepted)
    }
    // Both the zero-recipient and provider-accepted paths require a checked,
    // atomic completion write. An HTTP success must mean it was persisted.
    await store.complete(id, attempt)
    return result(200, { accepted, total, completed: true })
  } catch {
    if (claimed) {
      let reconciliationPersisted = false
      try {
        await store.reconcile(id, attempt)
        reconciliationPersisted = true
      } catch {
        // The original durable claim still blocks another invocation.
      }
      return result(500, {
        error: 'Broadcast incomplete; do not resend without reconciliation',
        accepted,
        total,
        needsReconciliation: true,
        reconciliationPersisted,
      })
    }
    // A claim insert may have committed despite a lost DB response. A retry
    // must go through the same atomic claim; it cannot bypass that guard.
    return result(500, { error: 'Failed to prepare or claim broadcast', retryThroughClaim: true })
  }
}
