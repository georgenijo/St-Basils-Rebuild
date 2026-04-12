# Architect Review — Issue #179: Add auth callback route and set-password page for invited users

## VERDICT: APPROVED

## Review Summary

The plan correctly implements the standard Supabase PKCE auth callback + set-password flow for Next.js App Router. It follows established patterns in the codebase (LoginForm, dev-bypass route handler, auth layout), uses proper cookie handling, and includes Zod validation. No database changes are needed. The scope is appropriate for the issue.

## Detailed Review

### Correctness: PASS

- The plan correctly identifies the PKCE flow: callback route receives `code` param → `exchangeCodeForSession(code)` → redirect to `/set-password`.
- Step ordering is correct: Zod schema first (dependency for action), then callback route (entry point), then action + form + page.
- The `type` parameter handling (invite vs recovery → `/set-password`) is correct — both flows need the user to set/reset a password.
- Role-based redirect after password set matches the existing pattern in `login.ts` lines 49-66.

### Architecture Alignment: PASS

- **RLS is the authorization layer**: N/A — no table operations, only Supabase Auth API calls. Correct decision to skip RLS planning.
- **Server components by default**: Set-password page is a server component; only the form is `'use client'`. Correct.
- **Sanity for content, Supabase for data**: N/A — this is auth flow only.
- **One ticket per branch**: Scope is tight — just the callback route and set-password page. No scope creep.

### Database Design: PASS

No database changes. Correct — the invite/recovery flow is entirely handled by Supabase Auth API.

### Security: PASS

- The callback route doesn't expose token details on error — redirects to `/login` with a generic error. Good.
- The set-password page requires an active session (server-side `getUser()` check). This prevents unauthorized access.
- Zod validation on password input before calling `updateUser()`. Good.
- All redirect targets are hardcoded internal paths — no open redirect risk.
- Password minimum 8 chars is reasonable (Supabase default is 6, but 8 is better practice).

### Implementation Quality: PASS

- Steps are atomic and independently verifiable — each has a `tsc --noEmit` check.
- Pattern references are specific (file paths, line numbers for key patterns).
- The cookie handling pattern reference to `dev-bypass/route.ts` is correct and proven.

### Risk Assessment: PASS

- All risks from the context brief are addressed in the mitigation table.
- One additional concern: the plan should note that Supabase's redirect URL allowlist in the dashboard must include the callback URL. This is documented in "Out of Scope" which is appropriate — it's a configuration step, not a code change.

## Required Changes (if REJECTED)

N/A

## Recommendations (non-blocking)

- **CONCERN**: In Step 2, consider also passing the `type` query param to `/set-password` so the page can show contextual messaging ("Complete your account setup" for invite vs "Reset your password" for recovery). This is a nice-to-have, not required.
- In Step 3, the action should handle the edge case where `supabase.auth.getUser()` succeeds but the profile lookup fails (e.g., trigger hasn't fired yet for a brand new invite). Default to `/member` redirect in that case.

## Approved Scope

- New file: `src/app/api/auth/callback/route.ts` — GET handler for PKCE code exchange
- New file: `src/actions/set-password.ts` — server action for password update
- New file: `src/components/features/SetPasswordForm.tsx` — client form component
- New file: `src/app/(auth)/set-password/page.tsx` — set-password page
- Modified file: `src/lib/validators/user.ts` — add `setPasswordSchema`
