# QA Scenarios — Issue #161: Admin: assign event costs to families

## S1: Charges page route exists and compiles

- Navigate to `/admin/events/<id>/charges`
- Expect: page returns valid response (200 or redirect to login), not 404 or 500

## S2: Charges page returns 404 for non-existent event

- Navigate to `/admin/events/00000000-0000-0000-0000-000000000000/charges`
- Expect: 404 response

## S3: Event detail page has "Manage Charges" button

- Navigate to an event detail page `/admin/events/<id>`
- Expect: "Manage Charges" button visible alongside "Edit Event" button

## S4: EventChargesForm renders with required elements

- On charges page: total cost input, family search, submit button visible
- Submit button disabled when no families selected and no total entered

## S5: Family search filtering works

- Type in search input
- Expect: family list filters to matching names

## S6: Select All / Deselect All bulk actions

- Click "All" button — all families selected
- Click "None" button — all families deselected

## S7: Even split calculation displays correctly

- Enter total cost, select families
- Expect: charge breakdown shows even split amount per family

## S8: Custom amounts mode toggle

- Toggle from "Even Split" to "Custom Amounts"
- Expect: per-family input fields appear

## S9: Mismatch warning in custom mode

- In custom amounts mode, enter amounts that don't sum to total
- Expect: amber warning message displayed

## S10: Submit button text reflects selection count

- Select 1 family: "Assign to 1 Family"
- Select 3 families: "Assign to 3 Families"

## S11: Regression — public pages still load

- Homepage, /about, /events, /contact return 200
- No JS console errors

## S12: Regression — admin routes compile

- /admin responds (not 404 or 500)
- /admin/events responds (not 404 or 500)

## S13: Charges page — back link navigates to event detail

- "Back to Event" link present and points to correct URL

## S14: No JS console errors on charges page

- Load charges page
- Expect: no JavaScript errors in console (excluding Turnstile)
