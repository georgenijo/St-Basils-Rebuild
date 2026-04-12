# Context Brief — Issue #179: Add auth callback route and set-password page for invited users

## Issue Summary

When an admin invites a user via `inviteUserByEmail`, Supabase sends an invite email with a confirmation link. There is currently no auth callback route to exchange the invite token for a session, and no set-password page for the invited user to create their password. The same callback route is needed for `sendPasswordReset` (recovery flow).

## Type

feature

## Acceptance Criteria

- Auth callback route at `/api/auth/callback` exchanges invite/recovery tokens into sessions via `supabase.auth.exchangeCodeForSession()`
- Set-password page (e.g., `/set-password`) allows the user to set their password via `supabase.auth.updateUser({ password })`
- Handles both `type=invite` and `type=recovery` flows
- After setting password, user is redirected to the appropriate portal based on their role (admin → `/admin/dashboard`, member → `/member`)
- The `sendPasswordReset` action in `src/actions/users.ts` works end-to-end with the new callback route

## Codebase Analysis

### Files Directly Involved

| File                                          | Why                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `src/app/api/auth/callback/route.ts`          | **NEW** — auth callback route to exchange code for session              |
| `src/app/(auth)/set-password/page.tsx`        | **NEW** — set-password page UI                                          |
| `src/components/features/SetPasswordForm.tsx` | **NEW** — client component for password form (pattern: `LoginForm.tsx`) |
| `src/actions/set-password.ts`                 | **NEW** — server action for `updateUser({ password })`                  |
| `src/lib/validators/user.ts`                  | **MODIFY** — add Zod schema for set-password validation                 |
| `src/lib/supabase/server.ts`                  | Reference — server-side Supabase client creation                        |
| `src/lib/supabase/client.ts`                  | Reference — browser-side Supabase client creation                       |
| `src/lib/supabase/middleware.ts`              | Reference — session refresh middleware                                  |
| `src/actions/users.ts`                        | Reference — `sendPasswordReset` depends on callback route               |
| `src/app/(auth)/login/page.tsx`               | Reference — page pattern in (auth) route group                          |
| `src/components/features/LoginForm.tsx`       | Reference — client form component pattern                               |
| `src/app/api/auth/dev-bypass/route.ts`        | Reference — existing API route auth pattern with cookie handling        |

### Database Impact

- Tables affected: None — this is purely auth flow (Supabase Auth handles tokens)
- New tables needed: None
- Migration dependencies: None
- RLS considerations: None — `supabase.auth.exchangeCodeForSession()` and `updateUser()` are Supabase Auth API calls, not table operations

### Existing Patterns to Follow

| Pattern                                   | Example File                                                  | Notes                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API route with Supabase + cookie handling | `src/app/api/auth/dev-bypass/route.ts`                        | Uses `createServerClient` from `@supabase/ssr` with manual cookie get/set on the response. Critical for the callback route to properly set session cookies. |
| Auth page layout                          | `src/app/(auth)/layout.tsx` + `src/app/(auth)/login/page.tsx` | Centered layout with white card, logo, heading. Set-password page should match.                                                                             |
| Client form component                     | `src/components/features/LoginForm.tsx`                       | Uses `useActionState` hook, `Button` from `@/components/ui`, shows error messages, loading spinner.                                                         |
| Server action with validation             | `src/actions/login.ts`                                        | `'use server'` directive, validates input, calls Supabase auth, redirects on success.                                                                       |
| Zod validators                            | `src/lib/validators/user.ts`                                  | Zod v4 schemas with descriptive error messages.                                                                                                             |
| Redirect URL validation                   | `src/lib/validators/redirect.ts`                              | `isValidRedirectUrl()` prevents open redirect attacks — use for any redirect destination.                                                                   |

### Test Coverage

- Existing tests that touch this area: `e2e/smoke/admin.spec.ts` tests auth guard redirects
- Test gaps: No tests for invite flow or password reset flow

### Related Issues

| Issue     | Relationship                                                            |
| --------- | ----------------------------------------------------------------------- |
| #174      | Invite status badges — invite flow discovered broken while testing this |
| #185      | Member directory — members need to complete invite flow to access       |
| #156-#160 | Member portal tabs — all depend on members having working accounts      |

## Risks

- **Supabase PKCE flow**: Supabase Auth uses PKCE by default. The invite/recovery email contains a URL with a `code` query parameter. The callback route must call `exchangeCodeForSession(code)` to establish the session. If the code exchange fails (expired, already used), the user needs a clear error path.
- **Cookie handling in route handler**: The callback route is an API route (`route.ts`), not a server component. Cookies must be set on the `NextResponse` object manually (pattern from `dev-bypass/route.ts`), not via `next/headers` cookies.
- **Token type detection**: After exchanging the code for a session, the route needs to determine whether this is an invite or recovery flow to redirect appropriately. Supabase includes a `type` parameter in the redirect URL.
- **Password validation**: Need minimum password requirements (Supabase defaults to 6 chars, but we should enforce something reasonable).
- **Session state on set-password page**: The user arrives at `/set-password` with an active session (established by the callback route). The `updateUser({ password })` call works because the user is authenticated. If the session is missing (e.g., direct navigation), the page should redirect to login.

## Key Conventions

- Server components by default; `'use client'` only for interactive forms
- Zod validation on all user input before processing
- Use `isValidRedirectUrl()` for any redirect targets
- `@/lib/supabase/server` for server-side, `@/lib/supabase/client` for browser-side
- Follow existing (auth) route group layout pattern
- Button component from `@/components/ui`
