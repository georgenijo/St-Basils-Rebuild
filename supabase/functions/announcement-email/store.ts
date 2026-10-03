import type { Announcement, BroadcastStore, Claim, Subscriber } from './lifecycle.ts'

type DbResult = { data: unknown; error: unknown }
// The subset used here is compatible with supabase-js and a synthetic DB.
interface Query {
  select(columns: string): Query
  eq(column: string, value: unknown): Query
  is(column: string, value: null): Query
  single(): PromiseLike<DbResult>
  then: PromiseLike<DbResult>['then']
}
export interface Database {
  from(table: string): {
    select(columns: string): Query
    update(values: Record<string, unknown>): Query
  }
  rpc(name: string, args: Record<string, unknown>): PromiseLike<DbResult>
}

function checked(result: DbResult): unknown {
  if (result.error) throw new Error('Broadcast database operation failed')
  return result.data
}

export function createBroadcastStore(db: Database): BroadcastStore {
  async function updateClaim(id: string, attempt: string, values: Record<string, unknown>) {
    const data = checked(
      await db
        .from('announcement_email_broadcasts')
        .update(values)
        .eq('announcement_id', id)
        .eq('attempt_id', attempt)
        .eq('state', 'sending')
        .select('announcement_id')
        .single()
    )
    if (!data) throw new Error('Broadcast claim not updated')
  }
  return {
    async getAnnouncement(id) {
      const data = checked(await db.from('announcements').select('*').eq('id', id).single())
      if (!data) throw new Error('Announcement not found')
      return data as Announcement
    },
    async getSubscribers() {
      const data = checked(
        await db
          .from('email_subscribers')
          .select('email, name, unsubscribe_token')
          .eq('confirmed', true)
          .is('unsubscribed_at', null)
      )
      if (!Array.isArray(data)) throw new Error('Subscribers not returned')
      return data as Subscriber[]
    },
    async claim(id, attempt, total) {
      const data = checked(
        await db.rpc('claim_announcement_email', { p_id: id, p_attempt: attempt, p_total: total })
      ) as Claim | null
      if (!data || !['claimed', 'already_sent', 'ineligible', 'blocked'].includes(data.outcome)) {
        throw new Error('Invalid claim response')
      }
      return data
    },
    progress: (id, attempt, accepted) => updateClaim(id, attempt, { accepted_count: accepted }),
    async complete(id, attempt) {
      checked(await db.rpc('complete_announcement_email', { p_id: id, p_attempt: attempt }))
    },
    reconcile: (id, attempt) => updateClaim(id, attempt, { state: 'needs_reconciliation' }),
  }
}
