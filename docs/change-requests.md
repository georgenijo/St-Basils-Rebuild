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

| column                   | type        | notes                                                        |
| ------------------------ | ----------- | ------------------------------------------------------------ |
| `id`                     | uuid pk     | `gen_random_uuid()`                                          |
| `requester_id`           | uuid        | `auth.users(id)`                                             |
| `title`                  | text        | 3–120 chars                                                  |
| `description`            | text        | 10–5000 chars                                                |
| `page_path`              | text        | site path starting with `/`, e.g. `/` or `/giving`           |
| `target_selector`        | text null   | CSS selector captured by the element picker                  |
| `target_text`            | text null   | ≤500 chars of the picked element's visible text              |
| `status`                 | text        | see lifecycle below; default `queued`                        |
| `branch_name`            | text null   | set by worker                                                |
| `pr_number`              | int null    | set by worker                                                |
| `pr_url`                 | text null   | set by worker                                                |
| `preview_url`            | text null   | Vercel preview deployment URL (root, no path)                |
| `verification`           | jsonb null  | `{ verdict: 'pass'\|'fail'\|'unsure', summary, checks }`     |
| `revision_base_sha`      | text null   | verified commit a requested revision builds on (see below)   |
| `github_cleanup_pending` | bool        | admin closed it; the worker still has to close the PR/branch |
| `claimed_by`             | text null   | worker id                                                    |
| `claimed_at`             | timestamptz |                                                              |
| `attempts`               | int         | default 0, incremented on claim                              |
| `error`                  | text null   | last failure, human readable                                 |
| `created_at`             | timestamptz |                                                              |
| `updated_at`             | timestamptz | trigger-maintained                                           |

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
  An admin can reply with **Request changes** to send it back (see
  "Revisions" below); a plain reply is only a note.
- `needs_attention` — something needs a human (see `error` and the thread).
- `merging` — an admin chose **Approve & merge**; the merge is in progress
  (see "Approving and merging").
- `live` — the merged change is confirmed on stbasilsboston.org (final).
- `merged` / `closed` — worker syncs PR state after review, or an admin
  closed the request (see "Closing a request" below). `closed` is final.

### Revisions

On a `ready_for_review` request the reply form offers two choices:

- **Add a note** (default) — saved to the thread with `intent = 'note'`; the
  status does not change and the agent is not woken. The worker labels notes
  in its prompts as background comments that are never instructions.
- **Request changes** — the reply is saved with `intent = 'revision'`, the
  verified commit (`verification.commit_sha`) is copied into
  `revision_base_sha`, the request goes back to `queued` with a fresh attempt
  budget (`attempts = 0`), and the site posts a system message and wakes the
  agent.

Replies go through `public.reply_to_change_request(request_id, body, intent)`
(admins only, `SECURITY DEFINER`), which saves the reply and any requeue in
one transaction with the request row locked. A note or revision submitted
after the request stopped being ready (e.g. a stale page, or another admin
won) is rejected without saving anything, so the worker never sees it as an
instruction. Any other reply that lands on a ready request is stored as a
note, and only an explicit "Reply and requeue" (`intent = 'requeue'`) sends a
`needs_attention` request back to the queue.

The thread tags these replies "Note" and "Requested changes".

When the worker claims a request that has `revision_base_sha`, `branch_name`
and `pr_number`, it re-drafts the PR and checks out the branch **at the
verified commit** (anything pushed after it, such as a failed earlier
revision, is dropped by the next force-push). The agent is told the change is
already present and to apply the latest requested changes on top, with the
whole thread as context. The revision is committed on top and goes through
the same CI, preview and verification gates with fresh evidence. The PR body
lists the whole branch diff.

Any request that already has a PR is only worked on through that PR: the
worker checks it is still open when it starts and again right before pushing
(a merged or closed PR syncs the request status and stops), and updates that
PR by number rather than opening a replacement. If the verified commit is
confirmed to be gone from the branch (deleted or rewritten), the worker says
so in the thread and rebuilds the whole change from `main`; a network or git
failure stops the run with an error instead. Replies to a `needs_attention`
revision requeue it as usual and keep building on the same verified commit.

### Approving and merging

With `CHANGE_REQUEST_GITHUB_TOKEN` set on the website, a `ready_for_review`
request shows **Approve & merge** in its status card. Without it the button
is hidden and the server action refuses, and merging stays a GitHub step.
The button is only enabled when a server-side check (streamed in, so the page
does not wait on GitHub) confirms:

- the PR is open, not a draft, and has no conflicts;
- its head is exactly the verified commit (`verification.commit_sha`);
- the newest run of each required check (Validate, Unit Tests, Change Request
  Agent Service, Browser Flow Tests) succeeded on that commit.

Approving binds to the verified commit shown on the page and goes through a
reservation first:

1. `begin_change_request_merge(request_id, sha)` (admins only) moves the
   request from `ready_for_review` to **`merging`** only if its passing
   verification is for exactly that commit, and records `approved_by`,
   `approved_at`, `approved_sha` and a reservation id (`approval_id`). Close, "Request changes" and the
   worker's claim all refuse a `merging` request, and a second approval gets
   "the request changed", so nothing can be closed or superseded under a
   merge.
2. The site re-checks GitHub readiness for that commit, including that the PR
   still targets `main`. If it is not ready, `release_change_request_merge`
   puts the request back to `ready_for_review` with a note in the thread.
3. The PR is squash-merged with GitHub's `sha` guard pinned to the approved
   commit.
4. `record_change_request_merge` (service role, idempotent) sets
   `status = 'merged'`, `merge_commit_sha` and `merged_at`, and posts
   "Approved and merged by …" in the same transaction.

If GitHub's answer is uncertain (timeout or 5xx), or recording fails, the
request stays `merging` and the agent is woken. The worker's PR sync records
the merge once GitHub shows it, closes the request if the PR was closed, or
releases a reservation still unmerged after 10 minutes. A release must name
the reservation's `approval_id` (and the age is re-checked in the same
transaction), so a stale caller can never cancel a newer approval. A merge is
attributed to the website approval only if the merged head is the approved
commit. PR sync, the job's "PR merged meanwhile" stop and closed-request
cleanup all record merges made directly on GitHub the same way. `merged` is
final, like `closed`, and a `merging` request can only become `merged` or (by
release) `ready_for_review`, so no other writer can reopen it under a merge.

The token is a **fine-grained personal access token** limited to
`georgenijo/St-Basils-Rebuild`, with Pull requests: read & write, Contents:
read & write (merging needs it), and Checks: read-only. It lives only in the
Vercel environment (Production; add it to Preview only if previews should
merge too) and belongs in the account and secret register (#334).
`CHANGE_REQUEST_GITHUB_REPO` overrides the repository (default
`georgenijo/St-Basils-Rebuild`). A GitHub App installation token would also
work but needs token minting code; the fine-grained token is the smaller
change. To rotate: create a new token, update Vercel, redeploy, then revoke
the old one.

### Confirming the change is live

After a merge (from the request page or on GitHub) the request is `merged`
with its `merge_commit_sha`. The worker then confirms the change reached
stbasilsboston.org, with no Vercel credential:

1. It reads production from GitHub deployments, which Vercel's GitHub
   integration reports in the **Production** environment. Production is
   currently serving the change when the newest deployment whose latest
   status is `success` is the merge commit or a descendant of it (checked
   with GitHub compare). An `inactive` (replaced or rolled back) deployment
   never counts, and a newer descendant counts even if Vercel skipped or never
   finished the merge's own build.
2. It requests the request's page on the live domain (`SITE_URL` +
   `page_path`) and needs a 2xx response.
3. `record_change_request_live_check` moves the request to the final status
   **`live`** (`live_at`) and posts "Live on site ↗ <url>" in one transaction.

Every merged request gets an outcome within 30 minutes of its merge. If it is
still not confirmed by then, it is reported once instead: the merge's own
production deployment failed, no deployment went live, the page kept failing
to load or returned non-2xx, or GitHub lookups kept failing. The request stays
`merged` with `error` (shown on the request page) and `live_check_failed_at`
set, and the thread gets "Not confirmed live: …". Both outcomes go through the
same RPC, and only the first one for a request counts. A merged request
recorded without a merge commit gets it from its PR; if it cannot be found,
that is reported too.

Approve & merge wakes the agent. Every maintenance sweep checks without
waiting. A one-shot run waits up to `LIVE_WAIT_MS` (default 10 minutes, and
interruptible on shutdown) before exiting, while just-merged changes are
still deploying. The request page keeps auto-refreshing while a merged
request awaits its outcome. `merged` can only become `live`, and `live` is
final.

### Undoing a live change

A `live` (or `merged`) request with a `merge_commit_sha` shows **Undo this
change…**. After confirmation, `request_change_request_undo` (admins only,
row-locked) creates a linked **undo request**:

- title "Undo: <original title>", the same page and picked element;
- `revert_of` set to the original and `revert_commit_sha` set to its merge
  commit; status `queued`.

It posts a system message in each thread linking the two, and the site wakes
the agent and opens the undo request. There is only one undo at a time: if
one is in progress or done, the original links to it instead of offering
another.

The worker handles an undo request by reverting exactly what `main`
integrated from the original pull request, instead of running the agent. It
checks that the PR was merged as the recorded commit, then uses git's
tree-level, rename-aware three-way revert:

- a merge commit is reverted against main (`-m 1`);
- a PR integrated commit by commit (GitHub rebase-and-merge, or a
  fast-forward, detected by matching patch-ids against the PR's commits from
  `refs/pull/N/head`) has all of its commits reverted;
- otherwise (a squash) the single merge commit is.

Only the merge's own change is undone, never identical changes that reached
main through another PR. Edits follow later renames. The result must pass the
same type/content policy as an agent's edit (no symlinks or special files, no
`'use server'` modules) and the staged-diff guardrails. Then it publishes as
usual: a draft PR "Undo website update <id>" whose commit says "This reverts
commit …", the same CI on the exact commit, the Vercel preview and the
browser verification. The original thread gets "Undo pull request #N is open"
with the link. From there it is a normal request: Approve & merge, then the
live check.

If later changes touched the same lines, nothing is resolved automatically:
the undo goes to `needs_attention` for a developer. That also happens when
there is nothing left to undo. A CI failure on an undo is left for a human
(there is no agent repair round). "Request changes" on an undo goes through
the agent, on top of the verified undo; if that verified undo is gone from
its branch, the worker stops and asks for a new undo instead of quietly
re-undoing. A closed undo still counts as the request's undo until the
worker has closed its PR, so a replacement cannot race a PR that might still
be merged.

### Closing a request

The status card on a `queued`, `ready_for_review` or `needs_attention`
request has **Close request…**, which asks for a reason. Requests the agent
is working on (`in_progress`, `verifying`) cannot be closed until it stops.
`public.close_change_request(request_id, reason)` (admins only,
`SECURITY DEFINER`) locks the row, re-checks the status, flips it to
`closed`, sets `github_cleanup_pending` when the request has a PR or branch,
and saves the reason as the admin's message in the private thread, all in
one transaction. The site then posts a system message and, if there is
GitHub cleanup to do, wakes the agent. In its maintenance sweep the worker
closes the PR (with a generic comment, never the reason), deletes the
`change-request/*` branch and clears the flag.

`closed` is final: the `change_requests_closed_is_final` trigger rejects any
later status change except to `merged` (a PR merged on GitHub before the
close was processed). The claim RPC only takes `queued` requests, so a closed
request is never claimed again, and replies to it are only saved.

### `change_request_messages`

`id`, `request_id` (fk, cascade), `author_kind` (`requester` | `agent` |
`system`), `author_id` (uuid null), `body` (1–5000 chars), `intent`
(`note` | `revision` | null; requester replies on ready requests only),
`created_at`.
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
shrinks the stored image to a small WebP with `sharp`. It is sent with
`Cache-Control: private, no-cache` and an ETag, so the browser keeps the bytes
but revalidates (authorized, usually a cheap 304) on every use; clicking a tile
opens the full-size signed URL.

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
requests. `CHANGE_REQUEST_GITHUB_TOKEN` (optional) — enables **Approve &
merge** (see above). Worker: see `services/change-request-agent/README.md`; its "Email
notifications" section lists what the managed agent needs to email when a
request is ready for review or needs attention (`RESEND_API_KEY` as a sealed
agent secret, `CHANGE_REQUEST_NOTIFY_EMAIL`, optional
`CHANGE_REQUEST_FROM_EMAIL`).
