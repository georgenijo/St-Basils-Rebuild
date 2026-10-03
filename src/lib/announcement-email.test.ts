import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { broadcast, type Announcement } from '../../supabase/functions/announcement-email/lifecycle'
import { createBroadcastStore } from '../../supabase/functions/announcement-email/store'

const id = '00000000-0000-4000-8000-000000000001'
const announcement: Announcement = {
  id,
  title: 'Synthetic announcement',
  slug: 'synthetic',
  body: null,
  published_at: '2026-10-03T00:00:00Z',
  send_email: true,
  email_sent_at: null,
}

class SyntheticDatabase {
  record = { ...announcement }
  subscribers = Array.from({ length: 201 }, (_, i) => ({
    email: `fixture-${i}@example.invalid`,
    name: null,
    unsubscribe_token: `synthetic-${i}`,
  }))
  claim: { attempt: string; state: string; accepted: number; total: number } | null = null
  fail = new Set<string>()
  audienceCount: number | null | undefined = undefined
  beforeClaim?: () => void
  failOnce(operation: string) {
    this.fail.add(operation)
  }
  response(operation: string, data: unknown) {
    if (this.fail.delete(operation)) return { data: null, error: { message: 'Synthetic DB fault' } }
    return { data, error: null }
  }
  from(table: string) {
    let update: Record<string, unknown> | null = null
    const filters: Record<string, unknown> = {}
    const execute = () => {
      if (table === 'announcements') {
        if (update) {
          const res = this.response('complete', this.record)
          if (!res.error) Object.assign(this.record, update)
          return res
        }
        return this.response('fetch', this.record)
      }
      if (table === 'email_subscribers')
        return {
          ...this.response('subscribers', this.subscribers),
          count: this.audienceCount === undefined ? this.subscribers.length : this.audienceCount,
        }
      const operation = update?.state ? 'reconcile' : 'progress'
      const res = this.response(operation, { announcement_id: id })
      if (res.error) return res
      if (
        !this.claim ||
        this.claim.attempt !== filters.attempt_id ||
        this.claim.state !== 'sending'
      ) {
        return { data: null, error: { message: 'No matching claim' } }
      }
      if (update?.accepted_count !== undefined) this.claim.accepted = Number(update.accepted_count)
      if (update?.state) this.claim.state = String(update.state)
      return res
    }
    const query = {
      select: () => query,
      update: (values: Record<string, unknown>) => {
        update = values
        return query
      },
      eq: (column: string, value: unknown) => {
        filters[column] = value
        return query
      },
      is: () => query,
      single: async () => execute(),
      then: <TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
        resolve?:
          | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
          | null,
        reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ) => Promise.resolve(execute()).then(resolve, reject),
    }
    return query
  }
  async rpc(name: string, args: Record<string, unknown>) {
    if (name === 'claim_announcement_email') {
      this.beforeClaim?.()
      if (this.fail.delete('claim')) return { data: null, error: { message: 'Claim failed' } }
      if (this.record.email_sent_at) return this.response('', { outcome: 'already_sent' })
      if (!this.record.send_email || !this.record.published_at) {
        return this.response('', { outcome: 'ineligible' })
      }
      if (this.claim) return this.response('', { outcome: 'blocked' })
      this.claim = {
        attempt: String(args.p_attempt),
        state: 'sending',
        accepted: 0,
        total: Number(args.p_total),
      }
      if (this.fail.delete('claim_response_lost'))
        return { data: null, error: { message: 'Lost response' } }
      return this.response('', { outcome: 'claimed', record: { ...this.record } })
    }
    const res = this.response('complete', null)
    if (res.error) return res
    if (
      !this.claim ||
      this.claim.attempt !== args.p_attempt ||
      this.claim.accepted !== this.claim.total
    ) {
      return { data: null, error: { message: 'Incomplete claim' } }
    }
    this.record.email_sent_at = '2026-10-03T01:00:00Z'
    this.claim.state = 'completed'
    if (this.fail.delete('complete_response_lost'))
      return { data: null, error: { message: 'Lost response' } }
    return res
  }
}

function edge(db = new SyntheticDatabase(), transport = 'mock') {
  let handler!: (req: Request) => Promise<Response>
  const accepted: string[] = []
  let calls = 0
  let failCall = Infinity
  let throwCall = Infinity
  let pause: (() => Promise<void>) | undefined
  let providerResponse: unknown | undefined
  const requests: RequestInit[] = []
  const env: Record<string, string> = {
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-test-only',
    SUPABASE_URL: 'http://database.invalid',
    RESEND_API_KEY: 'synthetic-provider-only',
    SITE_URL: 'https://site.invalid',
    EMAIL_TRANSPORT: transport,
    EMAIL_SINK_BASE_URL: 'http://sink.invalid',
    TEST_SUPPORT_SECRET: 'synthetic-sink-only',
  }
  const sourcePath =
    process.env.ANNOUNCEMENT_EMAIL_SOURCE ??
    resolve('supabase/functions/announcement-email/index.ts')
  const source = readFileSync(sourcePath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  runInNewContext(compiled, {
    exports: {},
    require: (path: string) => {
      if (path.startsWith('https://esm.sh/')) return { createClient: () => db }
      if (path === './lifecycle.ts') return { broadcast }
      if (path === './store.ts') return { createBroadcastStore }
      throw new Error(`Unexpected import: ${path}`)
    },
    Deno: {
      env: { get: (name: string) => env[name] },
      serve: (fn: typeof handler) => {
        handler = fn
      },
    },
    crypto: { randomUUID: () => crypto.randomUUID() },
    Response,
    fetch: async (_url: string, init: RequestInit) => {
      calls++
      requests.push(init)
      const body = JSON.parse(String(init.body))
      if (calls === throwCall) {
        // Simulate provider acceptance followed by a dropped response.
        accepted.push(...(Array.isArray(body) ? body : [body]).map((email) => email.to))
        throw new Error('Synthetic lost provider response')
      }
      if (calls === failCall) return new Response('Synthetic provider rejection', { status: 503 })
      accepted.push(...(Array.isArray(body) ? body : [body]).map((email) => email.to))
      if (pause) await pause()
      return new Response(
        JSON.stringify(
          providerResponse ??
            (Array.isArray(body)
              ? { data: body.map((_, i) => ({ id: `synthetic-${calls}-${i}` })) }
              : {})
        ),
        { status: 200 }
      )
    },
  })
  const invoke = async (record: unknown = announcement) => {
    const res = await handler(
      new Request('http://edge.invalid', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer synthetic-test-only',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ record }),
      })
    )
    return { status: res.status, body: await res.json() }
  }
  return {
    requests,
    setProviderResponse: (value: unknown) => {
      providerResponse = value
    },
    db,
    invoke,
    accepted,
    handler,
    rejectAt: (n: number) => {
      failCall = n
    },
    throwAt: (n: number) => {
      throwCall = n
    },
    pause: (fn: () => Promise<void>) => {
      pause = fn
    },
  }
}

describe('production announcement Edge handler with synthetic DB and fake sends', () => {
  it('returns a failure for announcement fetch errors, with no send or completion', async () => {
    const e = edge()
    e.db.failOnce('fetch')
    expect((await e.invoke()).status).toBe(500)
    expect(e.accepted).toHaveLength(0)
    expect(e.db.record.email_sent_at).toBeNull()
    expect((await e.invoke()).status).toBe(200)
  })

  it('skips only genuinely completed or currently ineligible announcements', async () => {
    const e = edge()
    e.db.record.email_sent_at = '2026-10-03T00:00:00Z'
    expect((await e.invoke()).body.skipped).toBe(true)
    e.db.record.email_sent_at = null
    e.db.record.send_email = false
    expect((await e.invoke()).body.skipped).toBe(true)
    expect(e.accepted).toHaveLength(0)
  })

  it('does not trust stale webhook eligibility or content', async () => {
    const e = edge()
    e.db.subscribers = []
    e.db.beforeClaim = () => {
      e.db.record.send_email = false
    }
    expect((await e.invoke({ ...announcement, email_sent_at: 'stale' })).body.reason).toBe(
      'ineligible'
    )
    expect(e.db.claim).toBeNull()
  })

  it('allows safe pre-claim retries for subscriber and claim errors', async () => {
    for (const operation of ['subscribers', 'claim']) {
      const e = edge()
      e.db.failOnce(operation)
      expect((await e.invoke()).status).toBe(500)
      expect(e.accepted).toHaveLength(0)
      expect((await e.invoke()).status).toBe(200)
      expect(new Set(e.accepted).size).toBe(201)
    }
  })

  it('refuses to claim or send when the subscriber audience is truncated or count is unknown', async () => {
    for (const count of [1001, null]) {
      const e = edge()
      e.db.audienceCount = count
      expect((await e.invoke()).status).toBe(500)
      expect(e.db.claim).toBeNull()
      expect(e.accepted).toHaveLength(0)
      expect(e.db.record.email_sent_at).toBeNull()
    }
  })

  it('requires a persisted completion even with zero recipients', async () => {
    const e = edge()
    e.db.subscribers = []
    e.db.failOnce('complete')
    expect((await e.invoke()).status).toBe(500)
    expect(e.db.record.email_sent_at).toBeNull()
    expect((await e.invoke()).status).toBe(409)
    expect(e.accepted).toHaveLength(0)
  })

  it('reports completion failure after sending and blocks resends', async () => {
    const e = edge()
    e.db.failOnce('complete')
    const res = await e.invoke()
    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ accepted: 201, needsReconciliation: true })
    expect(e.db.record.email_sent_at).toBeNull()
    expect((await e.invoke()).status).toBe(409)
    expect(e.accepted).toHaveLength(201)
  })

  it('serializes simultaneous invocations and sends each synthetic recipient once', async () => {
    const e = edge()
    let unblock!: () => void
    const barrier = new Promise<void>((r) => {
      unblock = r
    })
    e.pause(() => barrier)
    const first = e.invoke()
    // Let the first invocation reach the fake sink and hold it there.
    for (let i = 0; i < 20 && e.accepted.length === 0; i++) await Promise.resolve()
    const second = e.invoke()
    for (let i = 0; i < 20; i++) await Promise.resolve()
    unblock()
    const results = await Promise.all([first, second])
    expect(e.accepted).toHaveLength(201)
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect(new Set(e.accepted).size).toBe(201)
    expect((await e.invoke()).body.skipped).toBe(true)
  })

  it('stops after a partial mock batch and never automatically repeats it', async () => {
    const e = edge()
    e.rejectAt(102)
    const res = await e.invoke()
    expect(res.status).toBe(500)
    expect(res.body.accepted).toBe(100) // lower bound; one more accepted inside failed batch
    expect(e.accepted).toHaveLength(101)
    expect((await e.invoke()).status).toBe(409)
    expect(e.accepted).toHaveLength(101)
  })

  it('blocks retries after a provider accepted a batch but its response was lost', async () => {
    const e = edge(new SyntheticDatabase(), 'resend')
    e.throwAt(2)
    const res = await e.invoke()
    expect(res.body).toMatchObject({ accepted: 100, needsReconciliation: true })
    expect(e.accepted).toHaveLength(200)
    expect((await e.invoke()).status).toBe(409)
    expect(e.accepted).toHaveLength(200)
  })

  it('stops further batches when progress persistence fails, even if reconciliation also fails', async () => {
    const e = edge(new SyntheticDatabase(), 'resend')
    e.db.failOnce('progress')
    e.db.failOnce('reconcile')
    expect((await e.invoke()).body.reconciliationPersisted).toBe(false)
    expect(e.accepted).toHaveLength(100)
    expect((await e.invoke()).status).toBe(409)
    expect(e.accepted).toHaveLength(100)
  })

  it('blocks retry if the claim committed but its DB response was lost', async () => {
    const e = edge()
    e.db.failOnce('claim_response_lost')
    expect((await e.invoke()).status).toBe(500)
    expect((await e.invoke()).status).toBe(409)
    expect(e.accepted).toHaveLength(0)
  })

  it('truthfully handles a completion that committed before its response was lost', async () => {
    const e = edge()
    e.db.failOnce('complete_response_lost')
    expect((await e.invoke()).status).toBe(500)
    expect((await e.invoke()).body.skipped).toBe(true)
    expect(e.accepted).toHaveLength(201)
  })

  it('requires a complete provider acknowledgment rather than trusting HTTP 200', async () => {
    for (const response of [
      {},
      { data: [] },
      { data: [{ id: 'partial' }], errors: [{ index: 1 }] },
      { data: null },
    ]) {
      const e = edge(new SyntheticDatabase(), 'resend')
      e.setProviderResponse(response)
      expect((await e.invoke()).status).toBe(500)
      expect(e.db.record.email_sent_at).toBeNull()
      expect(e.accepted).toHaveLength(100)
      expect((await e.invoke()).status).toBe(409)
    }
  })

  it('uses strict validation and sends only documented Resend fields', async () => {
    const e = edge(new SyntheticDatabase(), 'resend')
    expect((await e.invoke()).status).toBe(200)
    expect(e.requests).toHaveLength(3)
    expect(e.requests[0].headers).toMatchObject({ 'x-batch-validation': 'strict' })
    const email = JSON.parse(String(e.requests[0].body))[0]
    expect(Object.keys(email).sort()).toEqual(['from', 'html', 'subject', 'to'])
  })

  it('keeps an abandoned durable claim blocked instead of expiring and resending', async () => {
    const e = edge()
    e.db.claim = { attempt: 'crashed-process', state: 'sending', accepted: 0, total: 201 }
    expect((await e.invoke()).status).toBe(409)
    expect(e.accepted).toHaveLength(0)
  })

  it('validates auth/method/payload before database or mail operations', async () => {
    const e = edge()
    expect((await e.handler(new Request('http://edge.invalid'))).status).toBe(405)
    expect((await e.handler(new Request('http://edge.invalid', { method: 'POST' }))).status).toBe(
      401
    )
    expect((await e.invoke(null)).status).toBe(400)
    expect(e.accepted).toHaveLength(0)
    expect(e.db.claim).toBeNull()
  })
})
