# QA Test Scenarios — Issue #157: Membership Tab

## S1: Auth guard — /member/membership redirects unauthenticated users
- Navigate to `/member/membership` without auth
- Expect redirect to `/login`

## S2: Route exists and returns valid response
- Navigate to `/member/membership`
- Expect 200 (if authenticated) or redirect to login (if not) — never 500

## S3: Page structure — heading and subtitle present
- Navigate to `/member/membership` (authenticated)
- Expect h1 "Membership" and subtitle text

## S4: Current Plan card renders
- Verify "Current Plan" heading visible
- Verify detail rows: Status, Plan, Next Payment, Paid Through, Member Since
- Verify progress bar with ARIA attributes

## S5: Dues Summary card renders
- Verify "Dues Summary" heading visible
- Verify detail rows: Annual Total, Paid So Far, Remaining

## S6: Payment History table renders
- Verify "Payment History" heading visible
- Verify table headers: Date, Period, Method, Amount, Status
- Verify empty state or payment rows

## S7: Status badge has correct styling
- Active: green badge
- Expired: red badge
- Pending: amber badge

## S8: Empty state — no family assigned
- User without family_id sees "not currently assigned to a family" message

## S9: Responsive — page usable on mobile viewport
- Set viewport to 375x667
- Verify cards stack vertically (single column)
- Verify table is scrollable (overflow-x-auto)

## S10: No console errors on page load
- Monitor console for errors
- Exclude known benign errors (Turnstile, NEXT_PUBLIC_)

## S11: Regression — member portal routes still work
- `/member` still loads (or redirects to login)
- Login page still renders

## S12: Currency formatting
- Amounts display as "$X.XX" format (USD)

## S13: Progress bar accessibility
- Progress bar has role="progressbar"
- Has aria-valuenow, aria-valuemin, aria-valuemax, aria-label
