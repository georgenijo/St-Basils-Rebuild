# QA Test Scenarios — Issue #129: feat: admin theme customization page (font picker, drag-and-drop)

## Scenarios

### S1: Admin settings page requires authentication

- **Type:** happy-path
- **Preconditions:** User is not logged in
- **Steps:**
  1. Navigate to `/admin/settings`
- **Expected:** Redirected to `/login` (auth guard)
- **Method:** playwright-cli

### S2: Login page still renders correctly (regression)

- **Type:** regression
- **Preconditions:** None
- **Steps:**
  1. Navigate to `/login`
- **Expected:** Email/password fields and Sign in button visible
- **Method:** playwright-cli

### S3: Admin sidebar contains Settings link

- **Type:** happy-path
- **Preconditions:** None (test via auth guard redirect — verify route exists)
- **Steps:**
  1. Navigate to `/admin/settings`
  2. Verify it redirects to login (not a 404)
- **Expected:** Route exists and is protected (redirect, not 404)
- **Method:** playwright-cli

### S4: Public homepage still loads (regression)

- **Type:** regression
- **Preconditions:** None
- **Steps:**
  1. Navigate to `/`
- **Expected:** Page returns 200, main heading visible
- **Method:** playwright-cli

### S5: DynamicFonts doesn't break public pages

- **Type:** regression
- **Preconditions:** None (no custom fonts saved = defaults)
- **Steps:**
  1. Navigate to `/`
  2. Check page loads without errors
  3. Check navigation still works
- **Expected:** Homepage renders normally, no JS errors, navigation links visible
- **Method:** playwright-cli

### S6: Other admin routes still protected (regression)

- **Type:** regression
- **Preconditions:** Not logged in
- **Steps:**
  1. Navigate to `/admin/dashboard`, `/admin/events`, `/admin/announcements`
- **Expected:** All redirect to login
- **Method:** playwright-cli

### S7: Public pages render with correct status codes (regression)

- **Type:** regression
- **Preconditions:** None
- **Steps:**
  1. Navigate to `/about`, `/events`, `/announcements`, `/contact`
- **Expected:** All return 200
- **Method:** playwright-cli

### S8: Settings route returns valid response (not 404/500)

- **Type:** happy-path
- **Preconditions:** Not logged in
- **Steps:**
  1. Navigate to `/admin/settings`
  2. Check response is NOT 404 or 500
- **Expected:** Response is 200 (with redirect) or 3xx redirect — not 404/500
- **Method:** playwright-cli

### S9: Mobile viewport — admin settings auth guard works

- **Type:** responsive
- **Preconditions:** Not logged in, mobile viewport
- **Steps:**
  1. Navigate to `/admin/settings` on mobile
- **Expected:** Same auth guard behavior on mobile
- **Method:** playwright-cli

### S10: Visual verification of settings page (authenticated)

- **Type:** happy-path
- **Preconditions:** Admin login credentials
- **Steps:**
  1. Login as admin
  2. Navigate to `/admin/settings`
  3. Verify font pickers visible
  4. Verify drag-and-drop sections visible
  5. Verify save button visible
- **Expected:** All UI elements render correctly
- **Method:** agent-browser
