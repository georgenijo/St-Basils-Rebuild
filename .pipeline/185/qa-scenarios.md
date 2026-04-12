# QA Scenarios — Issue #185: Member Directory

## S1: Directory page loads for authenticated member
- Navigate to `/member/directory` as logged-in member
- Page returns 200, shows "Directory" heading and search bar
- **Type**: Happy path

## S2: Directory page redirects unauthenticated users
- Navigate to `/member/directory` without auth
- Should redirect to login (302/redirect behavior from member layout)
- **Type**: Auth gate

## S3: Search filters families by family name
- Type a family name into the search bar
- Results count updates, only matching families shown
- **Type**: Happy path

## S4: Search filters by head of household name
- Type a head-of-household name into search bar
- Family card for that household appears in results
- **Type**: Happy path

## S5: Search with no matches shows empty state
- Search for "xyznonexistent12345"
- Shows "No families found" message with search term displayed
- **Type**: Edge case

## S6: Clear search shows all families
- Search for something, then clear the search input
- All families reappear, count resets to total
- **Type**: Edge case

## S7: Family card expands to show members
- Click a family card
- Members list appears with names and relationship badges
- `aria-expanded` toggles to "true"
- **Type**: Happy path

## S8: Family card collapses on second click
- Click an expanded card again
- Members list hides, `aria-expanded` toggles to "false"
- **Type**: Happy path

## S9: Only one card expanded at a time
- Expand family A, then click family B
- Family A collapses, family B expands
- **Type**: Interaction

## S10: Directory shows member count badge
- Each family card shows "N members" badge
- **Type**: UI detail

## S11: Family info subtitle shows head name, phone, address
- Family card subtitle shows available info joined by " · "
- Missing fields are omitted (not shown as dashes)
- **Type**: UI detail

## S12: "Since YYYY" shown on desktop, hidden on mobile
- Desktop: "Since 2024" visible next to chevron
- Mobile: hidden (responsive `hidden sm:block`)
- **Type**: Responsive

## S13: Directory sidebar nav item present
- "Directory" appears in sidebar navigation after "Shares"
- Has active state when on `/member/directory`
- **Type**: Navigation

## S14: Directory visibility toggle on family page
- Navigate to `/member/family`
- Toggle switch visible with "Member Directory" label
- Toggle has `role="switch"` and `aria-checked`
- **Type**: Happy path

## S15: Empty directory shows appropriate message
- If no families visible, shows "The member directory is empty."
- **Type**: Edge case

## S16: Regression — existing member portal pages still load
- `/member` (overview), `/member/family`, `/member/shares` still 200
- No JS console errors
- **Type**: Regression

## S17: Accessibility — search input has label
- Search input has `aria-label="Search families"`
- Results count has `aria-live="polite"`
- **Type**: Accessibility

## S18: Accessibility — card buttons have aria-expanded and aria-controls
- Each family card button has `aria-expanded` and `aria-controls`
- Controls ID matches the member list container
- **Type**: Accessibility

## S19: Accessibility — toggle has role="switch"
- Directory visibility toggle has `role="switch"` and `aria-checked`
- Has accessible label
- **Type**: Accessibility
