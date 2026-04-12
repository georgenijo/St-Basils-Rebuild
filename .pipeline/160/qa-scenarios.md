# QA Test Scenarios — Issue #160: Member portal: Shares tab

## Scenarios

### S1: Shares route exists and returns valid response

- **Type:** happy-path
- **Preconditions:** None (unauthenticated access is acceptable — should redirect)
- **Steps:**
  1. Navigate to /member/shares
- **Expected:** Response status < 500. Either renders the shares page (if authed) or redirects to login.
- **Method:** playwright-cli

### S2: Shares route redirects unauthenticated users or renders page

- **Type:** happy-path
- **Preconditions:** None
- **Steps:**
  1. Navigate to /member/shares
  2. Check the final URL
- **Expected:** Either on /member/shares (authed) or redirected to /login or /admin
- **Method:** playwright-cli

### S3: No console errors on shares route

- **Type:** error-state
- **Preconditions:** None
- **Steps:**
  1. Collect console errors
  2. Navigate to /member/shares
- **Expected:** No JS console errors (excluding known noise like Turnstile, NEXT*PUBLIC*)
- **Method:** playwright-cli

### S4: Shares route loads on mobile viewport

- **Type:** responsive
- **Preconditions:** None
- **Steps:**
  1. Set viewport to 375x667
  2. Navigate to /member/shares
- **Expected:** Status < 500, no console errors
- **Method:** playwright-cli

### S5: Regression — member overview still loads

- **Type:** regression
- **Preconditions:** None
- **Steps:**
  1. Navigate to /member
- **Expected:** Status < 500
- **Method:** playwright-cli

### S6: Regression — membership tab still loads

- **Type:** regression
- **Preconditions:** None
- **Steps:**
  1. Navigate to /member/membership
- **Expected:** Status < 500
- **Method:** playwright-cli

### S7: Regression — public pages still load

- **Type:** regression
- **Preconditions:** None
- **Steps:**
  1. Navigate to /, /events, /about, /giving
- **Expected:** Status 200, no console errors
- **Method:** playwright-cli

### S8: Page content structure (if authed)

- **Type:** happy-path
- **Preconditions:** Authenticated as a member
- **Steps:**
  1. Login as test member
  2. Navigate to /member/shares
  3. Verify page headings, summary cards region, table, previous years section exist
- **Expected:** H1 "Shares", summary region with 3 cards, table with correct headers, Previous Years section
- **Method:** agent-browser

### S9: Buy Shares panel opens and closes

- **Type:** happy-path
- **Preconditions:** Authenticated as a member
- **Steps:**
  1. Navigate to /member/shares
  2. Click "Buy Shares" button
  3. Verify slide-out panel appears with dialog role
  4. Click close button (X)
  5. Verify panel closes
- **Expected:** Panel opens on button click, closes on X click
- **Method:** agent-browser

### S10: Buy Shares panel — add and remove name pills

- **Type:** happy-path
- **Preconditions:** Authenticated, panel open
- **Steps:**
  1. Type a name in the input
  2. Press Enter
  3. Verify pill appears
  4. Type another name, click Add button
  5. Verify second pill appears and running total shows "2 shares · $100"
  6. Remove first name pill
  7. Verify total updates to "1 share · $50"
- **Expected:** Names are added as pills, total updates correctly, pills are removable
- **Method:** agent-browser

### S11: Buy Shares panel — Escape key closes panel

- **Type:** edge-case
- **Preconditions:** Authenticated, panel open
- **Steps:**
  1. Open Buy Shares panel
  2. Press Escape key
- **Expected:** Panel closes
- **Method:** agent-browser

### S12: Buy Shares panel — Submit disabled when no names

- **Type:** edge-case
- **Preconditions:** Authenticated, panel open, no names added
- **Steps:**
  1. Open Buy Shares panel
  2. Check "Submit Shares" button state
- **Expected:** Submit button is disabled
- **Method:** agent-browser

### S13: Buy Shares panel — empty name not added

- **Type:** edge-case
- **Preconditions:** Authenticated, panel open
- **Steps:**
  1. Leave name input empty
  2. Press Enter or click Add
- **Expected:** No pill added, no error
- **Method:** agent-browser
