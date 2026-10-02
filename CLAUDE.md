# St. Basil's Syriac Orthodox Church Website

The production app is the **Next.js rebuild** (`src/`, `README.md`). The legacy Bootstrap static site is archived at `archive/legacy-static-site/`.

## Overview

Next.js 15 (App Router) + React 19 website for St. Basil's Syriac Orthodox Church in Newton, MA. Serves the Jacobite Malayalee community in the New England region.

- **Address**: 73 Ellis Street, Newton, MA 02464
- **Domain**: stbasilsboston.org

## Technology Stack

| Layer             | Technology                                                                            |
| ----------------- | ------------------------------------------------------------------------------------- |
| App               | Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind CSS 4               |
| Structured data   | Supabase — events, announcements, subscribers, contact, families, payments, profiles  |
| Editorial content | Sanity — clergy, organizations, page copy, spiritual leaders, useful links            |
| Email             | Resend + React Email templates                                                        |
| Forms             | Server Actions, Zod, Cloudflare Turnstile                                             |
| Hosting           | Vercel (preview deploys on PRs; production auto-deploys on merge to `main`)           |

## Project Structure

```
src/
├── app/
│   ├── (public)/          # Marketing pages + Navbar/Footer; no auth check
│   ├── (auth)/            # Login, forgot-password, set-password; centred layout, no role check
│   ├── (admin)/admin/     # Admin dashboard + CRUD; requires profiles.role = 'admin'
│   ├── (member)/member/   # Member portal; requires profiles.role = 'member'  ⚠️ retiring — see Epic 10
│   ├── (dev)/             # admin-preview, showcase; dev/preview helpers only
│   ├── studio/[[...tool]] # Sanity Studio (embedded)
│   └── api/               # Webhooks, ICS, newsletter, OG images, test helpers, revalidation
├── actions/               # Server Actions
├── components/            # UI, layout, feature components
├── emails/                # React Email templates
├── lib/                   # Supabase, Sanity, validators, event-time, email
└── sanity/                # Schemas and GROQ queries

supabase/migrations/       # Postgres schema + RLS (applied to production on push to main)
services/change-request-agent/  # Standalone Node service (do not edit from this repo)
e2e/                       # Playwright smoke + CI integration specs
archive/                   # Legacy static site, design assets (archive/README.md)
```

### Route group details

| Group | URL prefix | Auth boundary | Layout notes |
|-------|-----------|---------------|--------------|
| `(public)` | `/` | None — middleware skips session refresh; pages are cache-eligible | Navbar + Footer |
| `(auth)` | `/login`, `/forgot-password`, `/set-password` | Middleware refreshes session; layout has no role check | Centred full-page form |
| `(admin)` | `/admin/**` | Layout redirects to `/login` if no user; redirects to `/` if `profile.role !== 'admin'` | AdminSidebar + AdminTopBar |
| `(member)` | `/member/**` | Layout redirects to `/login` if no user; redirects to `/` if `profile.role !== 'member'` | MemberSidebar + MemberTopBar |
| `(dev)` | `/admin-preview`, `/showcase` | No auth gate | Dev helpers, not in production navigation |
| `api` | `/api/**` | Per-route; middleware refreshes session for `/api` paths **except `/api/health`** (excluded from matcher) | Route handlers |
| `studio` | `/studio/**` | Sanity's own auth | Sanity Studio |

**Middleware session-refresh paths** (`src/lib/session-paths.ts`): `/admin`, `/member`, `/login`, `/forgot-password`, `/set-password`, `/rsvp`, `/api`. All other paths skip the Supabase `auth.getUser()` round-trip so public pages remain cache-eligible for Vercel/Next.js. Note: `/api/health` is also excluded from the middleware matcher entirely (`middleware.ts` line 54) so it never enters session refresh.

## Data Split

**Sanity (editorial content — edited in Studio):**
- Clergy, spiritual leaders, office bearers, organizations, acolytes & choir page, useful links, page content (privacy policy, terms of use)
- Schema types in `src/sanity/schemas/`
- Webhook → `POST /api/revalidate` (authenticated with `SANITY_WEBHOOK_SECRET`) triggers `revalidatePath()` for the affected route

**Supabase (operational data — managed via admin console or migrations):**
- `events`, `announcements`, `email_subscribers`, `contact_submissions`
- `profiles`, `families`, `family_members`, `shares`, `payments`, `event_charges`, `event_rsvps`
- `change_requests`, `change_request_messages`, `change_request_files` (metadata table; the private Storage bucket is named `change-requests`)
- `admin_audit_log`, `site_settings`

## Caching

Most `(public)` pages export `export const revalidate = 60` (60-second ISR). Exceptions that do **not** export it include `/about`, `/contact`, `/first-time`, `/giving` (static), and `/rsvp/[slug]` (session-aware — uses `createClient()` with cookies to prefill the logged-in user, so it is always dynamic).

**Sanity-backed pages** (`/spiritual-leaders`, `/our-clergy`, `/office-bearers`, `/our-organizations`, `/acolytes-choir`, `/useful-links`, `/privacy-policy`, `/terms-of-use`) call `sanityFetch()` (`src/lib/sanity/client.ts`), which calls `client.fetch(query, params, { next: { tags, revalidate } })` — Next.js fetch-level caching with ISR, defaulting to `revalidate: 60`. This is **not** `unstable_cache`; it uses the native `next-sanity` fetch integration.

**Supabase-backed public pages** (`/events`, `/announcements`, and their `[slug]` variants, plus the homepage) use `unstable_cache` with cache tags (`public-events`, `public-announcements`, `public-site-settings` — see `src/lib/cache-tags.ts`) and `revalidate: 60`.

The sitemap (`src/app/sitemap.ts`) uses `export const revalidate = 300`. The ICS feed uses `export const revalidate = 3600`. The admin logs page explicitly sets `export const revalidate = 0`; other authenticated layouts are request-bound by auth (no explicit revalidate export).

## Scripts (`package.json`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (`next dev`) |
| `npm run build` | Production build (`next build`) |
| `npm run ci:validate` | Format check + lint + typecheck + build (full CI gate) |
| `npm test` | Vitest unit tests |
| `npm run test:e2e:ci` | Playwright CI suite (`e2e/ci` + `e2e/smoke`, Chromium) |
| `npm run test:smoke` | Playwright smoke tests (`@smoke` grep) |
| `npm run typecheck` | TypeScript type check only |
| `npm run lint` | ESLint only |
| `npm run format:check` | Prettier check only |
| `npm run bench:public-nav` | Navigation performance benchmark |

## CI Jobs (`.github/workflows/ci.yml`)

Runs on every PR and push to `main`:

| Job | Runs on | What it does |
|-----|---------|--------------|
| **Validate** | every event | `npm ci` → `npm run ci:validate` (format check, lint, typecheck, build) |
| **Unit Tests** | every event | `npm ci` → `npm test` (Vitest) |
| **Change Request Agent Service** | every event | Installs service's own locked deps, runs its `typecheck` + `npx vitest run services/change-request-agent` |
| **Browser Flow Tests** | PR only | Spins up an isolated **local** Supabase stack + local Next.js build (`npm run build && npm run start`), installs Playwright Chromium, runs `npm run test:e2e:ci -- --project=chromium` with test-support flags (`TEST_SUPPORT_ENABLED`, mock email, Turnstile bypass) — these flags are **not** applied to any Vercel deployment |

**Lighthouse CI** (`.github/workflows/lighthouse.yml`) — PR only: waits for Vercel preview, runs Lighthouse, posts scores as a PR comment (no bypass secret in URL per #367/#371).

## Deployment

### App (Vercel)
- **Production**: Push or merge to `main` → Vercel auto-deploys to production.
- **Preview**: Every PR gets a Vercel preview URL (used by Browser Flow Tests and Lighthouse CI).

### Database migrations (Supabase)
- Push to `main` with changes under `supabase/migrations/**` triggers `.github/workflows/migrate.yml`.
- That workflow runs `supabase db push --db-url $SUPABASE_DB_URL --skip-vault` (transaction-pooler connection).
- Required GitHub secret: `SUPABASE_DB_URL` (replaces the legacy `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` approach).

### Content (Sanity)
- Sanity webhook POSTs to `/api/revalidate` on document change; `SANITY_WEBHOOK_SECRET` authenticates the request; affected Next.js routes are revalidated via `revalidatePath()`.

## Change-Request Agent PRs

The `services/change-request-agent/` worker opens PRs when processing admin change requests. These PRs:
- Do **not** contain a `Fixes #N` / `Closes #N` link — the worker intentionally omits closing keywords (see `services/change-request-agent/src/prbody.ts`).
- Open as drafts until CI passes and the Vercel preview is verified.
- Deploy to production only after a human merges them to `main` — at which point Vercel's normal auto-deploy runs (same as any other merge to `main`). The PR body's "nothing deploys until a human merges this PR" means no automatic merge; it does not prevent the standard post-merge auto-deploy.

`services/change-request-agent/` is a standalone service maintained separately. Changes to it, `supabase/migrations/`, or PRs opened by the worker should be made with awareness of their deployment consequences: service changes require a Docker image rebuild and redeploy on Family Host; migration changes push directly to production Postgres on the next `main` merge.

## Community / Member portal — Retiring

The `/member` portal and related community features are being retired. See **Epic 10**: https://github.com/georgenijo/St-Basils-Rebuild/issues/400

Do not implement new member/community features. Phases 1–4 are tracked in issues #401–#404; George's approval is required before Phase 1 (hide entry points) and Phase 4 (data drop).

## Other CI Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `claude.yml` | `@claude` mention in issues/PRs | Claude Code automation |
| `claude-code-review.yml` | Every PR | Claude Code automated review |
| `change-request-agent-image.yml` | Push/PR to `main` touching `services/change-request-agent/**` | **PR**: build-only validation (no registry login, no push). **Push to `main`**: builds and publishes image to GHCR (`ghcr.io/<repo>/change-request-agent`) |
| `change-request-agent-maintenance.yml` | Scheduled | Wakes the managed agent for periodic maintenance sweep |
