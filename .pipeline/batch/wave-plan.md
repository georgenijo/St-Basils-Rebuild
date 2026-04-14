# Wave Execution Plan

## Summary
- Issues: 3
- Waves: 3
- Estimated parallel pipelines at peak: 1 (strict linear chain — no parallelism possible)
- All 7 external dependencies satisfied (closed)

## Dependency Graph
```
#180 ──→ #184 ──→ #186
```

## Wave 1: Zero-fee P2P payment flow

| Issue | Title | Depends On | Complexity |
|-------|-------|------------|------------|
| #180 | Zero-fee payment flow: Zelle, Venmo, and Cash App integration | — | high |

**What this delivers:** The core payment submission loop. Member picks Zelle/Venmo/Cash App,
gets instructions + auto-generated reference memo (e.g. `DUES-APR26-NIJO`), taps "I've sent
the payment" → `payments` row created with `status = 'pending'`. Admin sees a pending queue
with Confirm/Reject actions. Schema migration adds `status`, `reference_memo`, `confirmed_by`,
`confirmed_at` to the existing `payments` table.

**External deps satisfied:** #148 (payments table), #154 (admin payment actions), #155 (member
portal layout), #159 (member payments tab) — all closed.

---

## Wave 2: Transactional notification emails

| Issue | Title | Depends On | Complexity |
|-------|-------|------------|------------|
| #184 | Transactional notification emails for payments, membership, and account events | #180 | high |

**What this delivers:** 10 React Email templates via Resend wired into existing server actions:
payment confirmed/rejected, event charge assigned, shares purchased/paid, dues reminders (14-day,
3-day, expired), membership renewed, welcome email, family linked. Daily cron job for dues
reminders. `notification_preferences` JSONB column on `profiles`.

**Why it must follow #180:** `confirmPayment()` and `rejectPayment()` — the two most important
email triggers — are created in #180. Wiring emails into actions that don't exist yet would fail.

**External deps satisfied:** #152 (shares actions), #154 (admin payment actions), #161 (event
cost assignment), #179 (auth callback/set-password) — all closed.

---

## Wave 3: Every.org online payment integration

| Issue | Title | Depends On | Complexity |
|-------|-------|------------|------------|
| #186 | Integrate Every.org for free online payments (ACH + card) | #180, #184 | medium |

**What this delivers:** Every.org widget as a 4th "Pay Online" option alongside the P2P methods
from #180. Webhook endpoint at `/api/webhooks/everyorg` auto-creates `payments` rows with
`status = 'confirmed'`. ACH shown as default with "Free" badge. Supports monthly recurring.

**Why it must follow #180:** Every.org is the 4th tab in the same payment method selector UI
built in #180. Cannot extend what doesn't exist.

**Why it must follow #184:** Issue body explicitly lists #184 as a dependency (confirmation
email fires after webhook). Also, the webhook-confirmed payment must trigger `PaymentConfirmed`
email — that template is built in #184.

**External deps satisfied:** #148 (payments table) — closed.

**⚠ Human gate:** Treasurer must confirm the Every.org fiscal intermediary model is acceptable
before this wave begins. Every.org issues tax receipts as a 501(c)(3) intermediary (receipts say
"via Every.org for St. Basil's Syriac Orthodox Church"). If treasurer rejects this, the documented
fallback is Givebutter.

---

## Validation

- [x] Every input issue appears in exactly one wave
- [x] No issue appears before its dependencies
- [x] Wave 1 has no in-batch dependencies
- [x] Dependency graph is acyclic (180 → 184 → 186, no cycles)

## Risks

1. **#186 may be blocked by a non-technical decision.** The treasurer needs to explicitly approve
   Every.org's fiscal intermediary model before any implementation work starts on Wave 3. This
   is called out in the issue itself. Don't start Wave 3 without that confirmation.

2. **#180 is the largest issue in the batch.** It has 5 suggested sub-tickets: schema migration,
   3 new server actions, Zod validators, member UI (method selector + per-method panels), and
   admin UI (pending queue). A broken or incomplete #180 blocks both downstream waves. Treat it
   as the critical path.

3. **#184 is also broad** — 10 email templates, 6 server action wiring points, a cron job, a DB
   migration, and a settings UI. If time is constrained, the issue's own sub-tickets suggest a
   natural split: templates + wiring first, then cron + preferences as a follow-up.

4. **Strict linear chain means no recovery window.** There's no parallelism — a failure at any
   wave blocks all subsequent waves. Ensure each wave's PR is fully merged and deployed before
   starting the next.

## Recommendations

- Run these waves **sequentially** — there is no opportunity for parallel execution in this batch.
- For #180: consider validating the schema migration in isolation before building the UI on top
  of it. The `ALTER TABLE payments` migration is a prerequisite for everything.
- For #184: start with the `PaymentConfirmed` and `PaymentRejected` templates since they're the
  most exercised in day-to-day treasurer operations. Welcome email can come last.
- **Do not start Wave 3 (#186) until the treasurer has given explicit approval** of the Every.org
  model. Block it in your task tracker and assign the confirmation task to the appropriate contact.
