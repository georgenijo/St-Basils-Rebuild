# QA Test Scenarios — Issue #179: Auth callback route and set-password page

## Scenarios

### S1: Auth callback — missing code parameter redirects to /login
- **Type:** error-state
- **Preconditions:** None
- **Steps:**
  1. GET `/api/auth/callback` (no query params)
  2. Observe redirect response
- **Expected:** Redirects to `/login?error=missing_code`
- **Method:** playwright-cli

### S2: Auth callback — missing code with type parameter still redirects to /login
- **Type:** edge-case
- **Preconditions:** None
- **Steps:**
  1. GET `/api/auth/callback?type=invite` (no code param)
  2. Observe redirect response
- **Expected:** Redirects to `/login?error=missing_code`
- **Method:** playwright-cli

### S3: Auth callback — invalid code redirects to /login with auth error
- **Type:** error-state
- **Preconditions:** None
- **Steps:**
  1. GET `/api/auth/callback?code=invalid-code-abc123&type=invite`
  2. Observe redirect response
- **Expected:** Redirects to `/login?error=auth_code_error` (Supabase rejects the invalid code)
- **Method:** playwright-cli

### S4: Set-password page — unauthenticated user redirects to /login
- **Type:** error-state
- **Preconditions:** No active session
- **Steps:**
  1. Navigate to `/set-password` without being logged in
  2. Observe redirect
- **Expected:** Redirects to `/login`
- **Method:** playwright-cli

### S5: Set-password page — renders form when authenticated
- **Type:** happy-path
- **Preconditions:** Active Supabase session (cannot easily simulate in Playwright without real auth)
- **Steps:**
  1. Log in with valid credentials
  2. Navigate to `/set-password`
  3. Check for form elements
- **Expected:** Page shows "Set Your Password" heading, password input, confirm password input, submit button
- **Method:** agent-browser (requires auth) — SKIPPED (no test credentials)

### S6: SetPasswordForm — client-side validation (min length)
- **Type:** edge-case
- **Preconditions:** Active session on set-password page
- **Steps:**
  1. Enter password shorter than 8 characters
  2. Enter matching confirm password
  3. Submit form
- **Expected:** HTML5 native validation blocks submission (minLength=8 on input)
- **Method:** agent-browser — SKIPPED (no test credentials)

### S7: SetPasswordForm — password mismatch
- **Type:** edge-case
- **Preconditions:** Active session on set-password page
- **Steps:**
  1. Enter valid password (8+ chars)
  2. Enter different confirm password
  3. Submit form
- **Expected:** Error message "Passwords do not match" displayed
- **Method:** agent-browser — SKIPPED (no test credentials)

### S8: Login page — still renders correctly (regression)
- **Type:** regression
- **Preconditions:** None
- **Steps:**
  1. Navigate to `/login`
  2. Check for email field, password field, sign-in button
- **Expected:** Login page renders with all expected elements
- **Method:** playwright-cli

### S9: Admin auth guard — still redirects unauthenticated (regression)
- **Type:** regression
- **Preconditions:** No active session
- **Steps:**
  1. Navigate to `/admin/dashboard` without auth
  2. Observe redirect
- **Expected:** Redirects to `/login`
- **Method:** playwright-cli

### S10: Zod schema validation — password boundaries
- **Type:** edge-case
- **Preconditions:** None — unit test level
- **Steps:**
  1. Validate 7-char password → fails
  2. Validate 8-char password → passes
  3. Validate 72-char password → passes
  4. Validate 73-char password → fails
  5. Validate mismatched passwords → fails
- **Expected:** All boundary conditions enforced correctly
- **Method:** playwright-cli (API-level via form action, but skipped — requires session)

### S11: Auth callback — type=recovery redirects to /set-password
- **Type:** happy-path
- **Preconditions:** Valid code (cannot provide in automated test)
- **Steps:**
  1. GET `/api/auth/callback?code=valid-code&type=recovery`
  2. Check redirect destination
- **Expected:** After successful code exchange, redirects to `/set-password`
- **Method:** manual (requires valid PKCE code)

### S12: Set-password page — responsive layout (mobile)
- **Type:** responsive
- **Preconditions:** Active session
- **Steps:**
  1. View `/set-password` on mobile viewport
  2. Check form is usable
- **Expected:** Form card is responsive, inputs are full-width, submit button is accessible
- **Method:** agent-browser — SKIPPED (no test credentials)
