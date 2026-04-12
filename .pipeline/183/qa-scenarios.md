# QA Test Scenarios — Issue #183: Event RSVP: public form, WhatsApp sharing, admin headcount view

## Scenarios

### S1: RSVP page renders for valid event with RSVP enabled

- **Type:** happy-path
- **Preconditions:** An event exists with `rsvp_settings.enabled = true`
- **Steps:**
  1. Navigate to `/rsvp/{slug}`
  2. Observe the page
- **Expected:** Page loads with event title, date, time, location, and RSVP form. Name field, headcount picker, and "Count me in" button are visible.
- **Method:** playwright-cli

### S2: RSVP page returns 404 for non-existent slug

- **Type:** error-state
- **Preconditions:** No event exists with slug `nonexistent-event-12345`
- **Steps:**
  1. Navigate to `/rsvp/nonexistent-event-12345`
- **Expected:** Page returns 404 Not Found
- **Method:** playwright-cli

### S3: RSVP page returns 404 for event with RSVP disabled

- **Type:** error-state
- **Preconditions:** An event exists with `rsvp_settings.enabled = false`
- **Steps:**
  1. Navigate to `/rsvp/{slug}`
- **Expected:** Page returns 404 Not Found
- **Method:** playwright-cli

### S4: Headcount picker buttons work correctly

- **Type:** happy-path
- **Preconditions:** RSVP page is loaded
- **Steps:**
  1. Click button "1" — should be selected by default
  2. Click button "3" — should become selected
  3. Click button "5+" — should show number input
- **Expected:** Button states toggle correctly, hidden headcount field updates. 5+ shows additional input.
- **Method:** playwright-cli

### S5: Conditional fields respect RSVP settings

- **Type:** happy-path
- **Preconditions:** Event has `rsvp_settings = { enabled: true, dietary: true, children_count: false, bringing: false, notes: true }`
- **Steps:**
  1. Navigate to RSVP page
  2. Check which fields are visible
- **Expected:** Dietary and notes fields are visible. Children count and bringing fields are NOT visible.
- **Method:** agent-browser (requires DB seeded event)

### S6: Name field is required

- **Type:** edge-case
- **Preconditions:** RSVP page is loaded
- **Steps:**
  1. Leave name field empty
  2. Submit form
- **Expected:** Browser native validation prevents submission (required attribute)
- **Method:** playwright-cli

### S7: Admin event detail page renders with RSVP panel

- **Type:** happy-path
- **Preconditions:** Admin is logged in, event with RSVP enabled exists
- **Steps:**
  1. Navigate to `/admin/events/{id}`
  2. Observe the page
- **Expected:** Event title, date, time shown. RSVP panel with summary cards (Families, Total People, Children), share link, WhatsApp button, RSVP table, and Export CSV button.
- **Method:** agent-browser (requires auth)

### S8: Admin event detail page shows disabled message when RSVP off

- **Type:** edge-case
- **Preconditions:** Admin logged in, event with RSVP disabled
- **Steps:**
  1. Navigate to `/admin/events/{id}`
- **Expected:** Message "RSVP is not enabled for this event" with link to edit
- **Method:** agent-browser (requires auth)

### S9: Events table links to detail page

- **Type:** happy-path
- **Preconditions:** Admin is logged in, events exist
- **Steps:**
  1. Navigate to `/admin/events`
  2. Click on an event title
- **Expected:** Navigates to `/admin/events/{id}` detail page
- **Method:** agent-browser (requires auth)

### S10: WhatsApp share link has correct format

- **Type:** happy-path
- **Preconditions:** Admin views event detail with RSVP enabled
- **Steps:**
  1. Inspect WhatsApp share button href
- **Expected:** Link format is `https://wa.me/?text=...` with event title, date, location, and RSVP URL
- **Method:** playwright-cli (inspect DOM)

### S11: Copy link button works

- **Type:** happy-path
- **Preconditions:** Admin views event detail with RSVP enabled
- **Steps:**
  1. Click "Copy" button
- **Expected:** Button text changes to "Copied!"
- **Method:** agent-browser (requires auth + clipboard API)

### S12: CSV export generates downloadable file

- **Type:** happy-path
- **Preconditions:** Admin views event detail with RSVPs
- **Steps:**
  1. Click "Export CSV" button
- **Expected:** CSV file downloads with correct headers and RSVP data
- **Method:** agent-browser (requires auth)

### S13: EventForm shows RSVP settings toggles

- **Type:** happy-path
- **Preconditions:** Admin is on event create page
- **Steps:**
  1. Navigate to `/admin/events/new`
  2. Toggle "Enable RSVP"
- **Expected:** Sub-toggles for dietary, children count, bringing, notes appear
- **Method:** agent-browser (requires auth)

### S14: OG meta tags set correctly for RSVP page

- **Type:** happy-path
- **Preconditions:** Event with RSVP enabled exists
- **Steps:**
  1. Fetch `/rsvp/{slug}` HTML
  2. Check OG meta tags
- **Expected:** og:title includes event title, og:image points to `/api/og/events/{slug}`, og:description includes date and "RSVP now"
- **Method:** playwright-cli

### S15: RSVP form renders on mobile viewport

- **Type:** responsive
- **Preconditions:** Event with RSVP enabled
- **Steps:**
  1. Load RSVP page in mobile viewport (375x812)
- **Expected:** Form is usable, headcount buttons wrap properly, no horizontal overflow
- **Method:** playwright-cli (mobile project)

### S16: Existing public pages still load (regression)

- **Type:** regression
- **Preconditions:** None
- **Steps:**
  1. Load homepage, events page, contact page
- **Expected:** All return 200 with nav and footer
- **Method:** playwright-cli

### S17: Zod validator rejects invalid headcount

- **Type:** edge-case
- **Preconditions:** N/A — unit test of validator
- **Steps:**
  1. Parse { name: "Test", headcount: 0 } with rsvpSchema
  2. Parse { name: "Test", headcount: 21 } with rsvpSchema
- **Expected:** Both fail validation
- **Method:** playwright-cli (use evaluateHandle or direct import)

### S18: Migration SQL syntax is valid

- **Type:** happy-path
- **Preconditions:** Migration file exists
- **Steps:**
  1. Read migration file
  2. Check for CREATE TABLE, RLS policies, indexes, trigger
- **Expected:** 1 CREATE TABLE, 5 CREATE POLICY, 2 CREATE INDEX, 1 CREATE TRIGGER
- **Method:** manual (file inspection — already verified)
