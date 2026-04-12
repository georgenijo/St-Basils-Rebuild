# Implementation Plan — Issue #154: Server actions: admin event charges and payment recording

## Approach Summary

Create `src/actions/admin-payments.ts` with two server actions (`assignEventCosts` and `recordPaymentReceived`) following the exact patterns from `src/actions/events.ts` and `src/actions/users.ts`. Extend the `recordPaymentSchema` in `src/lib/validators/member.ts` to include `related_event_id` and `related_share_id` optional fields required by the payments table constraints. The actions use the authenticated Supabase client (not admin client) since all authorization is enforced by RLS policies.

## Prerequisites

- Families table migration exists: `20260409000000_create_families.sql` ✓
- Shares table migration exists: `20260409000002_create_shares.sql` ✓
- Payments table migration exists: `20260409000003_create_payments.sql` ✓
- Event charges table migration exists: `20260409000004_create_event_charges.sql` ✓
- Zod validators exist in `src/lib/validators/member.ts` ✓
- Branch is clean ✓

## Steps

### Step 1: Extend recordPaymentSchema with relation fields

**Files:**

- `src/lib/validators/member.ts` — modify

**What to do:**
Add `related_event_id` and `related_share_id` as optional UUID fields to `recordPaymentSchema`. These are required by the `payments` table CHECK constraints:

- When `type='event'`, `related_event_id` must be non-null
- When `type='share'`, `related_share_id` must be non-null
- When `type='membership'` or `type='donation'`, both must be null

Add a Zod `.superRefine()` to enforce these conditional requirements at the validation layer (fail early instead of at DB constraint check).

Specifically, after line 85 (`note` field) and before the closing `})` on line 86, add:

```
related_event_id: z.string().uuid('Invalid event ID').optional().or(z.literal('')),
related_share_id: z.string().uuid('Invalid share ID').optional().or(z.literal('')),
```

Then chain `.superRefine()` after the object to validate:

- If `type === 'event'`, `related_event_id` must be a non-empty string
- If `type === 'share'`, `related_share_id` must be a non-empty string
- If `type === 'membership'` or `type === 'donation'`, neither should be set

Update the `RecordPaymentData` type export to reflect the new schema.

**Pattern to follow:**
The existing `buySharesSchema` (lines 30-45) shows how complex validation is done in this file.

**Verify:**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**

- `recordPaymentSchema` includes `related_event_id` and `related_share_id` optional fields
- `.superRefine()` enforces conditional requirements per payment type
- TypeScript compiles with no new errors

### Step 2: Create admin-payments.ts with assignEventCosts action

**Files:**

- `src/actions/admin-payments.ts` — create

**What to do:**
Create the file with `'use server'` directive. Implement `assignEventCosts`:

1. Parse formData: `event_id` as string, `charges` as JSON string (parse with `JSON.parse` then validate with `assignEventCostsSchema`)
2. Zod validate with `assignEventCostsSchema` from `@/lib/validators/member`
3. Auth check: `supabase.auth.getUser()` → query `profiles.role` → reject if not admin (follow pattern from `src/actions/users.ts:32-47`)
4. Insert into `event_charges`: use `supabase.from('event_charges').insert()` with array of `{ event_id, family_id, amount }` objects mapped from validated charges
5. Handle errors: catch 23505 (unique violation on `event_id, family_id`) with a user-friendly message about duplicate charges
6. `revalidatePath('/admin')` on success
7. Return `ActionState`

The `charges` array comes from formData as a JSON string (since FormData cannot natively represent arrays of objects). Parse it before Zod validation.

**Pattern to follow:**
`src/actions/events.ts:36-199` for overall structure. `src/actions/users.ts:32-47` for admin auth check pattern.

**Verify:**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**

- `assignEventCosts` function exists in `src/actions/admin-payments.ts`
- Follows `ActionState` pattern
- Validates with Zod, checks admin role, inserts event_charges, handles duplicate error

### Step 3: Add recordPaymentReceived action

**Files:**

- `src/actions/admin-payments.ts` — modify

**What to do:**
Add `recordPaymentReceived` to the same file:

1. Parse formData: extract `family_id`, `type`, `amount`, `method`, `note`, `related_event_id`, `related_share_id` from formData
2. Zod validate with `recordPaymentSchema` (now includes relation fields and superRefine)
3. Auth check: same admin check pattern as `assignEventCosts`
4. Insert payment row:
   ```
   supabase.from('payments').insert({
     family_id: parsed.data.family_id,
     type: parsed.data.type,
     amount: parsed.data.amount,
     method: parsed.data.method,
     note: parsed.data.note || null,
     recorded_by: user.id,
     related_event_id: parsed.data.type === 'event' ? parsed.data.related_event_id : null,
     related_share_id: parsed.data.type === 'share' ? parsed.data.related_share_id : null,
   })
   ```
5. If insert succeeds, apply side effects based on type:
   - **type='event'**: `supabase.from('event_charges').update({ paid: true }).eq('event_id', related_event_id).eq('family_id', family_id)`
   - **type='share'**: `supabase.from('shares').update({ paid: true }).eq('id', related_share_id)`
   - **type='membership'**: Compute new expiry. Use `families.membership_type` to determine duration: if 'monthly' add 1 month, if 'annual' add 1 year, default to 1 year. Read current family, compute new date from max of (current `membership_expires_at`, today), then update. Also set `membership_status` to 'active'.
6. `revalidatePath('/admin')` on success
7. Return `ActionState`

For membership expiry calculation:

- Fetch the family record to get `membership_type` and current `membership_expires_at`
- Base date = max(current `membership_expires_at` or today)
- If `membership_type === 'monthly'`, add 1 month; otherwise add 1 year
- Update `families` with new `membership_expires_at` and `membership_status = 'active'`

**Pattern to follow:**
`src/actions/events.ts` for DB operations, `src/actions/users.ts:32-47` for admin check.

**Verify:**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**

- `recordPaymentReceived` function exists and handles all 4 payment types
- Payment row is inserted with correct `related_event_id`/`related_share_id` per type
- Side effects update `event_charges.paid`, `shares.paid`, or `families.membership_expires_at`
- Membership expiry logic uses `membership_type` to determine duration

### Step 4: Lint and type-check

**Files:**

- Any files touched in steps 1-3

**What to do:**
Run full lint and type-check. Fix any issues introduced by the new code.

**Verify:**

```bash
npm run lint 2>&1 | tail -20
npx tsc --noEmit 2>&1 | tail -20
```

**Done when:**

- `npm run lint` passes with no new errors
- `npx tsc --noEmit` passes with no new errors

## Acceptance Criteria (Full)

- [ ] `assignEventCosts` server action creates `event_charges` rows for multiple families on an event
- [ ] `recordPaymentReceived` server action creates a `payments` row with `recorded_by` set to current admin
- [ ] For type='event' payments: `event_charges.paid` is set to true for the matching charge
- [ ] For type='share' payments: `shares.paid` is set to true for the matching share
- [ ] For type='membership' payments: `families.membership_expires_at` is updated based on membership_type
- [ ] Both actions reject non-admin users with "Forbidden: admin access required"
- [ ] Both actions validate input with Zod before any DB operation
- [ ] Duplicate event charge assignment returns a user-friendly error (not a raw DB error)

## RLS Policy Plan

No new RLS policies needed. All existing policies are sufficient:
| Table | Operation | Existing Policy | Sufficient? |
|-------|-----------|----------------|-------------|
| `event_charges` | INSERT | "Admins can insert event charges" — admin only | ✓ |
| `event_charges` | UPDATE | "Admins can update event charges" — admin only | ✓ |
| `payments` | INSERT | "Insert payments" — admin can insert any type | ✓ |
| `shares` | UPDATE | "Admins can update shares" — admin only | ✓ |
| `families` | UPDATE | "Update families" — admin can update all columns | ✓ |

## Risk Mitigation

| Risk                                        | Mitigation                                                                                                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| recordPaymentSchema missing relation fields | Step 1 extends the schema with `related_event_id` and `related_share_id` plus superRefine validation                                                                                            |
| Membership expiry logic undefined           | Step 3 defines clear logic: base from max(current expiry, today), add 1 month or 1 year based on `membership_type`                                                                              |
| Non-atomic side effects                     | Accept sequential operations; if side-effect UPDATE fails after payment INSERT, the payment is still valid and the admin can retry the side-effect. Log the error and return a warning message. |
| Bulk insert duplicate key error             | Step 2 catches 23505 error code and returns user-friendly message                                                                                                                               |

## Out of Scope

- Admin UI components for these actions (#161, #162 are separate issues)
- Unit tests for the new actions (can be added in a follow-up)
- E2E tests for payment flows

## Estimated Complexity

medium — Two server actions with straightforward CRUD operations, but `recordPaymentReceived` has conditional side-effect logic for 4 payment types and membership expiry calculation.
