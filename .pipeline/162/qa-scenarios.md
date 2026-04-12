# QA Test Scenarios — Issue #162: Admin: record payments received

## Scenarios

### S1: Payments route compiles and responds

- **Type:** happy-path
- **Preconditions:** App is deployed/running
- **Steps:**
  1. Navigate to `/admin/payments`
- **Expected:** Route responds with a status (not 404 or 500). May redirect to /login for unauthenticated users.
- **Method:** playwright-cli

### S2: Auth guard protects payments page

- **Type:** error-state
- **Preconditions:** User is NOT authenticated
- **Steps:**
  1. Navigate to `/admin/payments` without credentials
- **Expected:** Redirected to `/login` or blocked with 401/403
- **Method:** playwright-cli

### S3: Payments sidebar link exists

- **Type:** happy-path
- **Preconditions:** Authenticated as admin
- **Steps:**
  1. Login as admin
  2. Check sidebar navigation
- **Expected:** "Payments" link visible in sidebar, pointing to `/admin/payments`
- **Method:** agent-browser

### S4: Payments page renders summary cards

- **Type:** happy-path
- **Preconditions:** Authenticated as admin
- **Steps:**
  1. Navigate to `/admin/payments`
- **Expected:** Page heading "Payments" visible, summary cards (Total, Membership, Share, Event, Donation) visible
- **Method:** agent-browser

### S5: Payments table renders

- **Type:** happy-path
- **Preconditions:** Authenticated as admin
- **Steps:**
  1. Navigate to `/admin/payments`
- **Expected:** Table with columns: Family, Type, Amount, Method, Detail, Recorded By, Date. Shows empty state or data rows.
- **Method:** agent-browser

### S6: Record Payment button opens panel

- **Type:** happy-path
- **Preconditions:** Authenticated as admin on payments page
- **Steps:**
  1. Click "Record Payment" button
- **Expected:** Slide-out panel appears with "Record Payment" heading, form fields visible
- **Method:** agent-browser

### S7: Record Payment form has all required fields

- **Type:** happy-path
- **Preconditions:** Record Payment panel is open
- **Steps:**
  1. Inspect form fields
- **Expected:** Family selector, Payment Type radio cards (Membership, Share, Event, Donation), Amount input with $ prefix, Payment Method dropdown, Note textarea, Cancel and Record Payment buttons
- **Method:** agent-browser

### S8: Payment type conditionally shows event/share selectors

- **Type:** happy-path
- **Preconditions:** Record Payment panel is open
- **Steps:**
  1. Select "Event" payment type → event selector appears
  2. Select "Share" payment type → share selector appears (with "Select a family first" message if no family selected)
  3. Select "Membership" → no additional selector
  4. Select "Donation" → no additional selector
- **Expected:** Conditional fields appear/disappear based on payment type selection
- **Method:** agent-browser

### S9: Panel closes on Escape key

- **Type:** edge-case
- **Preconditions:** Record Payment panel is open
- **Steps:**
  1. Press Escape key
- **Expected:** Panel closes
- **Method:** agent-browser

### S10: Panel closes on backdrop click

- **Type:** edge-case
- **Preconditions:** Record Payment panel is open
- **Steps:**
  1. Click backdrop (dark overlay)
- **Expected:** Panel closes
- **Method:** agent-browser

### S11: Filter buttons work on payments table

- **Type:** happy-path
- **Preconditions:** Authenticated as admin on payments page
- **Steps:**
  1. Click each filter button (All Types, Membership, Share, Event, Donation)
- **Expected:** Table content filters accordingly, active filter is visually highlighted
- **Method:** agent-browser

### S12: Search input filters payments

- **Type:** happy-path
- **Preconditions:** Authenticated as admin on payments page with existing payments
- **Steps:**
  1. Type a family name in the search box
- **Expected:** Table filters to matching payments
- **Method:** agent-browser

### S13: Regression — public pages still work

- **Type:** regression
- **Preconditions:** App is deployed/running
- **Steps:**
  1. Navigate to homepage, /about, /events, /announcements, /contact
- **Expected:** All return 200
- **Method:** playwright-cli

### S14: Regression — homepage has no JS errors

- **Type:** regression
- **Preconditions:** App is deployed/running
- **Steps:**
  1. Navigate to homepage, listen for JS errors
- **Expected:** No uncaught JS errors
- **Method:** playwright-cli

### S15: Mobile responsive — payments page accessible

- **Type:** responsive
- **Preconditions:** Authenticated as admin, mobile viewport
- **Steps:**
  1. Open mobile hamburger menu
  2. Navigate to Payments
- **Expected:** Page renders correctly, table scrolls horizontally, panel fits mobile viewport
- **Method:** agent-browser
