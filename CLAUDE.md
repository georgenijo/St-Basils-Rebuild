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
| `api` | `/api/**` | Per-route; middleware always refreshes session for `/api` paths | Route handlers |
| `studio` | `/studio/**` | Sanity's own auth | Sanity Studio |

**Middleware session-refresh paths** (`src/lib/session-paths.ts`): `/admin`, `/member`, `/login`, `/forgot-password`, `/set-password`, `/rsvp`, `/api`. All other paths skip the Supabase `auth.getUser()` round-trip so public pages remain cache-eligible for Vercel/Next.js.

## Data Split

**Sanity (editorial content — edited in Studio):**
- Clergy, spiritual leaders, office bearers, organizations, acolytes & choir page, useful links, page content (privacy policy, terms of use)
- Schema types in `src/sanity/schemas/`
- Webhook → `POST /api/revalidate` (authenticated with `SANITY_WEBHOOK_SECRET`) triggers `revalidatePath()` for the affected route

**Supabase (operational data — managed via admin console or migrations):**
- `events`, `announcements`, `email_subscribers`, `contact_submissions`
- `profiles`, `families`, `family_members`, `shares`, `payments`, `event_charges`, `event_rsvps`
- `change_requests`, `change_request_messages`, `change_request_files` (Storage bucket)
- `admin_audit_log`, `site_settings`

## Caching

All `(public)` pages export `export const revalidate = 60` (60-second ISR). Pages backed by Supabase data (`events`, `announcements`) use `unstable_cache` with cache tags (`public-events`, `public-announcements`, `public-site-settings` — see `src/lib/cache-tags.ts`). Sanity-backed pages use `unstable_cache` with `revalidate: 60`.

The sitemap (`src/app/sitemap.ts`) uses `export const revalidate = 300`. The ICS feed uses `export const revalidate = 3600`. Admin pages use `export const revalidate = 0` (always dynamic).

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
| **Browser Flow Tests** | PR only | Spins up local Supabase stack, installs Playwright Chromium, runs `npm run test:e2e:ci -- --project=chromium` |

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
- Merge only after a human reviews and merges them; nothing deploys automatically.

Do not modify `services/change-request-agent/`, `supabase/migrations/`, or PRs opened by the change-request-agent worker.

## Community / Member portal — Retiring

The `/member` portal and related community features are being retired. See **Epic 10**: https://github.com/georgenijo/St-Basils-Rebuild/issues/400

Do not implement new member/community features. Phases 1–4 are tracked in issues #401–#404; George's approval is required before Phase 1 (hide entry points) and Phase 4 (data drop).

## Other CI Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `claude.yml` | `@claude` mention in issues/PRs | Claude Code automation |
| `claude-code-review.yml` | Every PR | Claude Code automated review |
| `change-request-agent-image.yml` | Push/PR to `main` touching `services/change-request-agent/**` | Builds + publishes worker Docker image to GHCR |
| `change-request-agent-maintenance.yml` | Scheduled | Wakes the managed agent for periodic maintenance sweep |
