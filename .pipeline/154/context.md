# Context Brief — Issue #154: Server actions: admin event charges and payment recording

## Issue Summary

Create two admin-only server actions in `src/actions/admin-payments.ts`: `assignEventCosts` (bulk-creates `event_charges` rows for families on a given event) and `recordPaymentReceived` (inserts a `payments` row and cascades side-effects to `event_charges.paid`, `shares.paid`, or `families.membership_expires_at` depending on payment type).

## Type

feature

## Acceptance Criteria

- Admin can assign split costs to multiple families for an event (bulk insert into `event_charges`)
- Admin can record payment for any type (membership, share, event, donation)
- Related records are updated: `event_charges.paid` → true for event payments, `shares.paid` → true for share payments, `families.membership_expires_at` updated for membership payments
- Members cannot access these actions (admin-only auth gate + RLS enforcement)

## Codebase Analysis

### Files Directly Involved

| File                                                          | Why                                                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/actions/admin-payments.ts`                               | **Create** — new file for both server actions                                                |
| `src/lib/validators/member.ts`                                | **Read** — already contains `assignEventCostsSchema` and `recordPaymentSchema` (lines 56-94) |
| `supabase/migrations/20260409000003_create_payments.sql`      | **Read** — payments table schema, RLS policies, constraints                                  |
| `supabase/migrations/20260409000004_create_event_charges.sql` | **Read** — event_charges table schema, RLS policies, unique constraint                       |
| `supabase/migrations/20260409000002_create_shares.sql`        | **Read** — shares table schema, `paid` column                                                |
| `supabase/migrations/20260409000000_create_families.sql`      | **Read** — families table schema, `membership_expires_at` column                             |
| `src/lib/supabase/server.ts`                                  | **Read** — `createClient()` for authenticated Supabase operations                            |

### Database Impact

- **Tables affected**: `payments` (INSERT), `event_charges` (INSERT + UPDATE), `shares` (UPDATE), `families` (UPDATE)
- **New tables needed**: None (all tables already exist from #148, #149, #147, #145)
- **Migration dependencies**: All prerequisite migrations exist: families (20260409000000), shares (20260409000002), payments (20260409000003), event_charges (20260409000004)
- **RLS considerations**: All operations go through the authenticated Supabase client. Admin-only INSERT on `event_charges` and `payments` are enforced at DB level. Admin-only UPDATE on `shares` and `families` admin-controlled columns are enforced by RLS. No new RLS policies needed.

### Key Schema Details

**`payments` table constraints:**

- `type` CHECK: must be `membership`, `share`, `event`, or `donation`
- `method` CHECK: must be `cash`, `check`, `zelle`, or `online`
- `chk_payments_event_relation`: when type='event', `related_event_id` must NOT be NULL and `related_share_id` must be NULL
- `chk_payments_share_relation`: when type='share', `related_share_id` must NOT be NULL and `related_event_id` must be NULL
- `chk_payments_no_relation`: when type='membership' or 'donation', both relation columns must be NULL
- Composite FK on `(related_share_id, family_id)` → `shares(id, family_id)` ensures share belongs to the correct family

**`event_charges` table:**

- Unique constraint on `(event_id, family_id)` — one charge per family per event
- `paid` boolean, default false

**`recordPaymentSchema` (Zod):** validates `family_id` (uuid), `type` (enum), `amount` (positive decimal), `method` (enum), `note` (optional string). Does NOT include `related_event_id` or `related_share_id` — these must be added or handled by the action.

**`assignEventCostsSchema` (Zod):** validates `event_id` (uuid), `charges` (array of `{family_id, amount}`).

### Existing Patterns to Follow

| Pattern                 | Example File                    | Notes                                                                                       |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| Server action structure | `src/actions/events.ts`         | `'use server'`, Zod parse → auth check → DB operation → revalidatePath → return ActionState |
| Admin auth check        | `src/actions/users.ts:32-47`    | getUser() → query profiles for role → reject if not admin                                   |
| ActionState type        | `src/actions/events.ts:16-19`   | `{ success: boolean, message: string, errors?: Record<string, string[]> }`                  |
| FormData parsing        | `src/actions/events.ts:43-57`   | Use `formData.get()` for scalar fields                                                      |
| Revalidation            | `src/actions/events.ts:196-197` | `revalidatePath('/admin/...')` after mutations                                              |

### Test Coverage

- Existing tests that touch this area: `src/actions/users.test.ts` (pattern for mocking Supabase), `src/lib/validators/member.test.ts` (validator tests for the schemas)
- Test gaps: No unit tests exist for `admin-payments.ts` (file doesn't exist yet). No E2E tests for payment recording flows.

### Related Issues

| Issue | Relationship                                                                    |
| ----- | ------------------------------------------------------------------------------- |
| #148  | Dependency — payments table migration (exists)                                  |
| #149  | Dependency — event_charges table migration (exists)                             |
| #150  | Dependency — validators (exist in `member.ts`)                                  |
| #151  | Sibling — family management server actions                                      |
| #152  | Sibling — shares server actions                                                 |
| #153  | Sibling — donations server actions                                              |
| #161  | Downstream — admin UI for assigning event costs (consumes `assignEventCosts`)   |
| #162  | Downstream — admin UI for recording payments (consumes `recordPaymentReceived`) |

## Risks

- **recordPaymentSchema missing relation fields**: The existing Zod schema does not include `related_event_id` or `related_share_id`, but the `payments` table constraints require them for type='event' and type='share'. The action must accept these from the form and pass them to the insert, or the DB constraint check will fail.
- **Membership expiry logic undefined**: The issue says "updates `families.membership_expires_at`" but doesn't specify how to compute the new date (e.g., +1 month from now? +1 year? based on membership_type?). The action needs a clear rule.
- **Non-atomic side effects**: `recordPaymentReceived` does INSERT + UPDATE in sequence. If the UPDATE fails after the INSERT succeeds, data is inconsistent. Consider whether a Supabase RPC/transaction is needed, or if the RLS-enforced operations are sufficient.
- **Bulk insert for assignEventCosts**: Supabase JS client supports array inserts, but if one row violates the unique constraint `(event_id, family_id)`, the entire batch may fail. Need to handle the 23505 duplicate key error.

## Key Conventions

- `'use server'` directive at top of action files
- Zod validation before any DB operation
- Auth check via `supabase.auth.getUser()` + profile role query for admin actions
- Return `ActionState` type: `{ success, message, errors? }`
- `revalidatePath` after mutations
- Use `createClient()` from `@/lib/supabase/server` (RLS-enforced, not admin client)
- UTC timestamps in DB; local conversion only at display boundary
