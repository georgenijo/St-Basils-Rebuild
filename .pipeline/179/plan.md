# Implementation Plan — Issue #179: Add auth callback route and set-password page for invited users

## Approach Summary

Create an auth callback API route that exchanges Supabase invite/recovery codes for sessions, then redirects to a set-password page. The set-password page uses a client-side form component (matching the LoginForm pattern) that calls a server action to set the user's password via `supabase.auth.updateUser()`. After success, redirect to the appropriate portal based on role. This is the standard Supabase PKCE auth flow for Next.js App Router.

## Prerequisites

- Branch `issue/179-add-auth-callback-route-and-set-password-page-for-invited-users` exists and is clean
- Supabase Auth is configured (already working — login flow exists)
- No database migrations needed

## Steps

### Step 1: Add Zod schema for set-password validation

**Files:**

- `src/lib/validators/user.ts` — modify

**What to do:**
Add a `setPasswordSchema` to the existing validators file. The schema validates:

- `password`: string, min 8 chars, max 72 chars (bcrypt limit)
- `confirmPassword`: string

Add a `.refine()` to verify password === confirmPassword.

Place it after the existing `userActionSchema` export (line 19). Also export the inferred type.

**Pattern to follow:**
Existing schemas in `src/lib/validators/user.ts` — same Zod v4 style with descriptive error messages.

**Verify:**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -i "validators/user" || echo "PASS"
```

**Done when:**

- `setPasswordSchema` is exported from `src/lib/validators/user.ts`
- TypeScript compiles without errors

### Step 2: Create the auth callback API route

**Files:**

- `src/app/api/auth/callback/route.ts` — create

**What to do:**
Create a GET route handler that:

1. Reads `code` and `type` query parameters from the URL (`type` can be `invite`, `recovery`, `signup`, `magiclink`, etc.)
2. If `code` is missing, redirect to `/login` with an error
3. Create a Supabase server client using `createServerClient` from `@supabase/ssr` with manual cookie handling on the response (pattern from `src/app/api/auth/dev-bypass/route.ts` lines 20-35)
4. Call `supabase.auth.exchangeCodeForSession(code)`
5. If the exchange fails, redirect to `/login` with an error query param
6. If `type` is `invite` or `recovery`, redirect to `/set-password`
7. Otherwise, redirect to `/` (fallback for other auth flows)

The cookie handling is critical: use the same pattern as `dev-bypass/route.ts` where cookies are read from `request.cookies.getAll()` and set on the `NextResponse` via `response.cookies.set()`.

**Pattern to follow:**
`src/app/api/auth/dev-bypass/route.ts` — Supabase server client creation with cookie bridging in a route handler.

**Verify:**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -i "callback" || echo "PASS"
```

**Done when:**

- `src/app/api/auth/callback/route.ts` exists
- Exports a GET handler
- TypeScript compiles without errors

### Step 3: Create the set-password server action

**Files:**

- `src/actions/set-password.ts` — create

**What to do:**
Create a server action `setPassword` that:

1. Has `'use server'` directive
2. Takes `(prevState: ActionState, formData: FormData)` — same `ActionState` type pattern as `src/actions/login.ts`
3. Extracts `password` and `confirmPassword` from formData
4. Validates with `setPasswordSchema` from `src/lib/validators/user`
5. Creates a Supabase server client via `createClient` from `@/lib/supabase/server`
6. Calls `supabase.auth.getUser()` — if no user, return error (session expired)
7. Calls `supabase.auth.updateUser({ password })` — if error, return error
8. Looks up the user's profile role to determine redirect destination
9. Calls `revalidatePath('/', 'layout')` then `redirect()` to `/admin/dashboard` (admin) or `/member` (member)

**Pattern to follow:**
`src/actions/login.ts` — same ActionState type, same Supabase client usage, same role-based redirect logic (lines 49-66).

**Verify:**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -i "set-password" || echo "PASS"
```

**Done when:**

- `src/actions/set-password.ts` exists with `setPassword` export
- Uses Zod validation before any auth calls
- TypeScript compiles without errors

### Step 4: Create the SetPasswordForm client component

**Files:**

- `src/components/features/SetPasswordForm.tsx` — create

**What to do:**
Create a `'use client'` component `SetPasswordForm` that:

1. Uses `useActionState` hook with `setPassword` action (pattern: `LoginForm.tsx` line 13)
2. Renders a `<form>` with `action={formAction}`
3. Has two password inputs: "New Password" and "Confirm Password"
4. Shows error messages from `state.errors` (field-level) and `state.message` (general)
5. Uses `Button` from `@/components/ui` with loading spinner during pending state
6. Input styling matches `LoginForm.tsx` exactly (same Tailwind classes)
7. Shows a success/info message at the top: "Create a password to complete your account setup." for invite flow

**Pattern to follow:**
`src/components/features/LoginForm.tsx` — exact same structure, hooks, UI patterns, and Tailwind classes.

**Verify:**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -i "SetPasswordForm" || echo "PASS"
```

**Done when:**

- `src/components/features/SetPasswordForm.tsx` exists
- Uses `'use client'` directive
- TypeScript compiles without errors

### Step 5: Create the set-password page

**Files:**

- `src/app/(auth)/set-password/page.tsx` — create

**What to do:**
Create a server component page that:

1. Exports metadata: `{ title: 'Set Password', description: "Set your password for St. Basil's church portal." }`
2. Checks for an authenticated user via `createClient` from `@/lib/supabase/server` + `supabase.auth.getUser()`
3. If no user (session expired or direct navigation), redirect to `/login`
4. Renders the same card layout as `login/page.tsx`: logo image, heading "Set Your Password", then `<SetPasswordForm />`
5. Uses the `(auth)` layout which provides the centered flex container

**Pattern to follow:**
`src/app/(auth)/login/page.tsx` — same layout structure, Image import, metadata export, auth check.

**Verify:**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -i "set-password" || echo "PASS"
```

**Done when:**

- `src/app/(auth)/set-password/page.tsx` exists
- Redirects to `/login` if no session
- TypeScript compiles without errors

## Acceptance Criteria (Full)

- [ ] Auth callback route at `/api/auth/callback` exchanges codes for sessions
- [ ] Callback route redirects to `/set-password` for invite and recovery flows
- [ ] Callback route redirects to `/login` on error (missing code, expired code)
- [ ] Set-password page requires an active session (redirects to login if none)
- [ ] Password form validates min 8 chars and password confirmation match
- [ ] `supabase.auth.updateUser({ password })` is called on form submit
- [ ] After password is set, user is redirected based on role (admin → `/admin/dashboard`, member → `/member`)
- [ ] `sendPasswordReset` in `src/actions/users.ts` works end-to-end with the callback route
- [ ] All new code passes `npm run lint && npx tsc --noEmit`

## RLS Policy Plan

No database tables are created or modified. All operations use Supabase Auth API (`exchangeCodeForSession`, `updateUser`, `getUser`) which are not subject to RLS.

## Risk Mitigation

| Risk                                                 | Mitigation                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Cookie handling in route handler                     | Follow exact pattern from `dev-bypass/route.ts` which is proven to work |
| Expired/invalid token                                | Redirect to `/login` with clear error; don't expose token details       |
| Direct navigation to `/set-password` without session | Server component checks `getUser()` and redirects to `/login`           |
| Open redirect attacks                                | Not applicable — all redirects are to hardcoded internal paths          |
| Password too weak                                    | Zod schema enforces min 8 chars; Supabase also enforces its own minimum |

## Out of Scope

- Email template customization (Supabase sends default invite/recovery emails)
- Supabase dashboard configuration for redirect URLs (must be configured manually in Supabase dashboard — `SITE_URL` and redirect allowlist)
- "Forgot password" link on the login page (separate UI concern)
- E2E tests for the invite flow (would require Supabase admin API in tests)

## Estimated Complexity

low — 5 new files, 1 modification, no database changes, well-established patterns to follow
