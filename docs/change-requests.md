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
                           claim → agent edits → guardrails → PR → Vercel preview
                           → Playwright verify → report + email
```

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
- `verifying` — PR open; waiting for the Vercel preview and running checks.
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
(10 MB limit; images and PDFs). Paths:

- attachments: `requests/<request_id>/attachments/<uuid>-<safe filename>`
- verification: `requests/<request_id>/verification/<label-slug>.png`

The admin UI shows files through short-lived signed URLs.

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
  `node_modules`. Only validated changes are copied into the trusted checkout
  where formatting, lint and typecheck run.
- The worker rejects any diff outside the allowlist (`src/app/(public)/**`,
  `src/components/**`, `public/**`, `src/app/globals.css`), non-source file
  types, tooling/config files, `'use server'` modules, and symlinks. Anything
  else becomes `needs_attention` with no PR.
- The GitHub repository is public. PRs carry the request title, page, the
  agent's public summary, changed files and checks — never the admin's
  description or thread — and every outbound GitHub payload is redacted for
  secrets, emails and phone numbers. The form warns admins about this.
- The Vercel protection-bypass secret (if set) is only ever sent to the preview
  origin, as a host-scoped cookie.
- The worker never merges. George merges; Vercel deploys on merge as usual.

## Environment

Website (Vercel): `CHANGE_REQUEST_NOTIFY_EMAIL` — who is emailed on new
requests. Worker: see `services/change-request-agent/README.md`.
