# Website change requests

Admins describe a website change in the admin console (`/admin/requests`). A
worker service (`services/change-request-agent/`) picks the request up, has a
Claude Code agent make the change on a branch, opens a pull request, waits for
the Vercel preview, verifies the preview in a real browser, and reports back
into the request thread and by email. **Nothing merges or deploys without a
human merging the PR.**

```
Admin (/admin/requests) ──▶ Supabase (change_requests, messages, files, Storage)
                                        ▲
                                        │ service role
                         change-request-agent (Family Host / any Fleet node)
                           claim → agent edits → guardrails → draft PR (before CI is
                           known to pass) → CI on the exact pushed commit (one repair
                           round on failure) → Vercel preview → Playwright verify
                           (screenshots + private recording) → mark PR ready for
                           review → report + email
```

The worker runs two ways from the same image: a persistent long-poll deploy
(e.g. Coolify), or as a Family Host **managed agent** — a bounded, per-run
container launched with `argv: ["node", "src/worker.ts", "--once"]` against a
public GHCR image, on job-owned scratch storage instead of a persistent
volume. See `services/change-request-agent/README.md`'s "Deploying on Family
Host" section for both modes, the image build
(`.github/workflows/change-request-agent-image.yml`), and the caveat that
managed-agent runs only do their maintenance sweep (stale-claim recovery, PR
sync, storage cleanup) once at startup rather than on an idle-period timer —
bounded to roughly 20 minutes by a scheduled GitHub Actions trigger
(`.github/workflows/change-request-agent-maintenance.yml`, see the README's
"Maintenance under a bounded-trigger dispatch model" section for its
best-effort/60-day-inactivity limitations and secret provisioning).

Production runs as the `st-basils-change-requests` managed agent on Family
Host (owner George). One trigger token, created with
`family-host agent token create`, is provisioned in two places: the Vercel
Production variable `FAMILY_HOST_AGENT_TRIGGER_TOKEN`, which wakes the agent
when a request is queued, and the GitHub Actions secret of the same name, used
by the maintenance workflow. Vercel reads the variable only on a new
deployment. To rotate, create a new token, update both places, redeploy, then
revoke the old token with `family-host agent token revoke`.

## Data contract

All three tables live in `public` and are created by
`supabase/migrations/20260928000000_create_change_requests.sql`.

### `change_requests`

| column            | type        | notes                                                    |
| ----------------- | ----------- | -------------------------------------------------------- |
| `id`              | uuid pk     | `gen_random_uuid()`                                      |
| `requester_id`    | uuid        | `auth.users(id)`                                         |
| `title`           | text        | 3–120 chars                                              |
| `description`     | text        | 10–5000 chars                                            |
| `page_path`       | text        | site path starting with `/`, e.g. `/` or `/giving`       |
| `target_selector` | text null   | CSS selector captured by the element picker              |
| `target_text`     | text null   | ≤500 chars of the picked element's visible text          |
| `status`          | text        | see lifecycle below; default `queued`                    |
| `branch_name`     | text null   | set by worker                                            |
| `pr_number`       | int null    | set by worker                                            |
| `pr_url`          | text null   | set by worker                                            |
| `preview_url`     | text null   | Vercel preview deployment URL (root, no path)            |
| `verification`    | jsonb null  | `{ verdict: 'pass'\|'fail'\|'unsure', summary, checks }` |
| `claimed_by`      | text null   | worker id                                                |
| `claimed_at`      | timestamptz |                                                          |
| `attempts`        | int         | default 0, incremented on claim                          |
| `error`           | text null   | last failure, human readable                             |
| `created_at`      | timestamptz |                                                          |
| `updated_at`      | timestamptz | trigger-maintained                                       |

**Lifecycle (`status`):**

```
submitting → queued → in_progress → verifying → ready_for_review → merged
                                  ↘            ↘ needs_attention      ↘ closed
                                   needs_attention (guardrail hit, agent failure, verify fail)
```

- `submitting` — inserted by the admin's server action while attachment rows
  are recorded; not claimable. The server flips it to `queued` when complete.
  Abandoned `submitting` rows are swept after an hour.
- `queued` — submitted, waiting for the worker.
- `in_progress` — claimed; agent is editing.
- `verifying` — PR open; waiting for CI on the exact pushed commit, then the
  Vercel preview and the Playwright verification pass.
- `ready_for_review` — PR open, preview verified; waiting for George to merge.
- `needs_attention` — something needs a human (see `error` and the thread).
- `merged` / `closed` — worker syncs PR state after review.

### `change_request_messages`

`id`, `request_id` (fk, cascade), `author_kind` (`requester` | `agent` |
`system`), `author_id` (uuid null), `body` (1–5000 chars), `created_at`.
The thread shown on the request detail page, oldest first.

### `change_request_files`

`id`, `request_id` (fk, cascade), `kind` (`attachment` | `verification`),
`storage_path`, `filename`, `content_type`, `size_bytes`, `label` (text null,
e.g. `before · desktop`), `created_at`.

Files are stored in the private Storage bucket **`change-requests`**
(images and PDFs, 10 MB limit as of the original migration;
`supabase/migrations/20260929000000_add_video_to_change_requests_bucket.sql`
widens `allowed_mime_types` to add `video/webm` and raises the limit to
50 MB for the Playwright screen recording below — not yet applied to
production). Paths:

- attachments: `requests/<request_id>/attachments/<uuid>-<safe filename>`
- verification (screenshots): `requests/<request_id>/verification/<label-slug>.png`
- verification (recording): `requests/<request_id>/verification/<label-slug>.webm`
  — a private screen recording of the desktop before/after Playwright pass.
  Recordings share `kind: 'verification'` with screenshots (distinguished by
  `content_type`, not a separate `kind` value, to avoid a schema change); the
  admin request page renders them with a native `<video controls>` element.
  Never linked or embedded anywhere public — the PR only ever gets the
  verdict comment (`buildVerdictComment`) and the `/admin/requests/<id>` link.

The admin UI shows files through short-lived signed URLs. Image tiles
(screenshots and image attachments) render from
`/admin/requests/<id>/files/<file_id>/thumbnail`, an admin-only route that
shrinks the stored image to a small WebP with `sharp` and lets the browser cache
it privately; clicking a tile opens the full-size signed URL.

### Access

- RLS: admins (`public.is_admin()`) can `SELECT` all three tables; admins can
  `INSERT` requests (own `requester_id`, status `queued`) and `requester`
  messages. Only the service role updates rows or writes agent/system messages.
- Storage: no user-facing policies. Attachments upload directly from the
  browser to `pending/<session>/…` through signed upload URLs that an
  admin-checked server action mints (so file bytes never pass through a Vercel
  function and its 4.5 MB body limit). The session is bound to the admin with an
  HMAC token. On submit the server checks magic bytes and real size, then moves
  the objects to `requests/<id>/attachments/…`. Signed read URLs are minted
  server-side.
- `public.claim_next_change_request(worker_id text)` atomically claims the
  oldest `queued` request with `FOR UPDATE SKIP LOCKED`, clears any earlier
  preview/verdict, and returns it. Executable by `service_role` only.

## Guardrails

- Only active admins can submit requests.
- Request text is untrusted input: the agent is told so, runs with file tools
  only (no shell, no network), inside a separate checkout that has no
  `node_modules`. Only validated changes are copied into the trusted checkout,
  where a local Prettier pass runs; lint, typecheck and the production build
  run in CI against the exact pushed commit instead (see below), not in the
  worker's own container.
- The worker rejects any diff outside the allowlist (`src/app/(public)/**`,
  `src/components/**`, `public/**`, `src/app/globals.css`), non-source file
  types, tooling/config files, `'use server'` modules, and symlinks. Anything
  else becomes `needs_attention` with no PR.
- **CI gating (behavior change from the original local-checks design):** the
  worker now pushes and opens the PR right after guardrails, before CI has
  run — CI runs against the exact pushed commit, the same way it would for
  any other PR. The PR is opened as a **draft** (`draft: true` at creation)
  specifically so this early-open doesn't make an unverified change look
  mergeable; it is only flipped to ready-for-review after CI, the Vercel
  preview, and the Playwright verification all pass (via GitHub's GraphQL
  `markPullRequestReadyForReview` — REST has no `draft` field to PATCH). If
  CI fails, the worker gives the agent one repair attempt (using the failing
  job's log) and pushes again; if it still fails, the PR is left open **and
  still draft** with failing checks and the request goes to
  `needs_attention` — the PR is not closed automatically, and nothing marks
  it ready for review. This means a PR can now exist (visible to anyone with
  repo access, but in draft) for a change that ultimately failed CI, which
  was not possible under the old model where a local check failure meant no
  PR was ever opened; draft status is the mitigation for that visibility
  change, not a separate manual gate.
- All four always-on PR CI jobs must actually succeed on the exact SHA:
  Validate, Unit Tests, Change Request Agent Service, and Browser Flow Tests.
  Existing PRs are re-drafted before another attempt edits or pushes a revision.
  The admin request is not marked ready until GitHub promotion succeeds.
- The repository is public. New branch names, titles, and commit messages use
  a generic label plus request ID, never private request titles. Public bodies
  include only the admin-only link, public changed files, and fixed checks.
  Generated summaries, request fields, attachment names, check details, and
  recordings stay private; public verdict comments link back to admin.
  Every outbound payload also receives the existing secret/contact redaction.
- The Vercel protection-bypass secret (if set) is only ever sent to the preview
  origin, as a host-scoped cookie.
- The worker never merges. George merges; Vercel deploys on merge as usual.

## Environment

Website (Vercel): `CHANGE_REQUEST_NOTIFY_EMAIL` — who is emailed on new
requests. Worker: see `services/change-request-agent/README.md`.
