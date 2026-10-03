# Announcement email lifecycle

The Edge function uses a service-only broadcast ledger, not the webhook's
`email_sent_at` snapshot, to guard sends. Apply migration
`20261003160000_announcement_email_claims.sql` before deploying the changed
`announcement-email` function. The migration is additive: no subscribers or
existing announcements are rewritten. Existing `email_sent_at` values remain
the completion boundary for historical broadcasts.

## Guarantees and failure behavior

- Fetch/preparation failures return HTTP 500, with no provider call. A later
  invocation must pass the atomic claim again.
- Claim locks the announcement, checks current eligibility and content, and
  inserts one unique ledger row per announcement. Competing invocations return
  HTTP 409 while it is claimed. The ledger stores counts and IDs, no email
  addresses, message bodies, unsubscribe tokens, or provider error bodies.
- The winning invocation sends sequential batches of at most 100. After each
  accepted batch it checks the progress write before sending another batch.
- Completion atomically updates both the ledger and `email_sent_at`. Both the
  zero-recipient path and all-batches-accepted path require successful database
  completion. Failed or lost completion responses return HTTP 500.
- After any failure following a claim, or a crashed worker, the durable claim
  blocks automatic replay. The function tries to persist `needs_reconciliation`;
  even if that write fails, the `sending` row continues blocking retries.

`accepted` counts only batches with a confirmed provider response. It is a lower
bound after a partial batch or lost response, not a delivery count. The provider
may have accepted mail even when the caller saw a timeout. Provider acceptance
does not establish inbox delivery. This design prevents concurrent/replayed
invocations from sending again; it does **not** provide exactly-once delivery.
It deliberately favors avoiding duplicate broadcasts over automatic recovery.
Neither pg_net nor this function supplies an automatic retry scheduler.

## Reconciliation (operator action, no automated resend)

A HTTP 409 or `needsReconciliation: true` requires an operator to investigate
the specific announcement/attempt, its counts, worker liveness, and provider
acceptance records through approved operational tooling. Do not delete or reset
a claim just because it is old: a provider request or original worker may still
be active. Do not unpublish/republish to bypass the claim. The function has no
claim expiry or automatic takeover, because either can duplicate accepted mail.

For confirmed full provider acceptance, an operator can arrange a separately
reviewed completion repair. For partial acceptance, retry only recipients proven
not accepted, after the original worker is stopped and the necessary send is
explicitly authorized. The ledger intentionally does not snapshot recipients;
counts alone cannot identify them. If acceptance cannot be established, leave
the broadcast blocked and report the uncertainty. No SQL reset/resend script is
provided here. Any reconciliation or real send remains a separate authorized
operation.

## Verification

`npm test -- src/lib/announcement-email.test.ts` exercises the production Edge
handler, store adapter, and lifecycle using a synthetic DB and intercepted
fetches. No request leaves the process. It covers DB errors, zero recipients,
completion/progress failures, concurrent requests, partial mock batches, provider
timeouts after acceptance, lost claim/completion responses, and abandoned claims.

`bash scripts/tests/test-announcement-email-db.sh` runs SQL/race tests in a
disposable PostgreSQL Docker container with synthetic announcements and no host
ports. It must never attach to a tenant DB or reset an existing Supabase stack.

## Deployment evidence and boundaries

The website is hosted on the repository's documented Vercel deployment; merging
to `main` can trigger its normal auto-deploy. Website deployment does not deploy
Supabase Edge functions. Migrations under `supabase/migrations/` use the existing
`Supabase Migrate` GitHub workflow and its `SUPABASE_DB_URL` secret; do not copy
that value into local output or infer Edge configuration from it.

Authenticated read-only inspection on 2026-10-03 found no listed functions for
project `St-Basils-Boston-Web` (`vemjfsdiebgrjtvxqcld`) and only the Edge secret
name `SUPABASE_DB_URL`. This does not establish a configured announcement sender
or historical deployment. Issue #417 tracks that missing evidence. Before a
separately coordinated Edge deployment, confirm the target project's function
state and the provenance of required `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
and `RESEND_API_KEY` configuration without exposing values. The existing trigger
also requires its documented Vault configuration; secret names in another host
do not prove that configuration. Do not provision speculative secrets or send
real announcements for smoke tests. Use synthetic providers/DBs only.
