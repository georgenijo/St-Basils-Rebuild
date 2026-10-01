# change-request-agent

Worker that turns website change requests from `/admin/requests` into verified
pull requests. Contract: [`docs/change-requests.md`](../../docs/change-requests.md).
**It never merges.** George merges; Vercel deploys on merge.

## What it does

One request at a time:

1. **Claim** — `claim_next_change_request(worker_id)` (service role), polling every 15 s.
   Every `PR_SYNC_INTERVAL_MS` it also requeues stale claims, syncs PR state
   (`ready_for_review`/`needs_attention`/`merging` with a PR → `merged` with
   its merge commit, or `closed`) and confirms merged changes are live
   (`merged` → `live` once the Vercel production deployment of the merge
   commit is up and the page responds on the live domain; see
   docs/change-requests.md "Confirming the change is live").
2. **Prepare** — deletes the request's old verification screenshots (objects
   and rows). Trusted clone in `WORK_DIR`: per job `git fetch origin main`,
   branch `change-request/<id8>-website-update` from `origin/main` (reuses an existing request branch),
   clean tree (keeps `node_modules`; `npm ci` only when `package-lock.json`
   changed). The **agent sandbox** is a separate plain export of the same
   commit at `$WORK_DIR/../agent-<id8>` (`git archive`, no `.git`, no
   `node_modules`, no `archive/`), removed after the job. Attachments are
   copied into the sandbox at `public/images/requests/<id8>/<safe-name>`.
3. **Agent** — `claude -p --restricted` in the **sandbox** with only
   `Read,Edit,Write,Glob,Grep` (no shell, no web, no subagents; file tools
   confined to the sandbox; no MCP; no session persistence). The prompt marks
   all request text and the thread as untrusted data. Generated summaries
   stay private in the authenticated admin console. `NEEDS_CLARIFICATION: …` → agent
   message + `needs_attention`, no PR.
4. **Guardrails** — the worker hashes the whole sandbox (lstat, never
   following links) and diffs it against a snapshot taken before the run, so
   every created/edited/deleted entry counts, including gitignored ones.
   Unreferenced attachments are dropped. Rejected: paths outside
   `src/app/(public)/**`, `src/components/**`, `public/**`,
   `src/app/globals.css`; under `src/` anything but `.ts/.tsx/.css`; under
   `public/` anything but `.png .jpg .jpeg .webp .gif .svg .pdf .ico .txt`;
   hidden files/dirs; config-like names (`config`/`rc` name parts,
   `package.json`, `tsconfig*`, `*.d.ts`, `middleware.*`, `next.config.*`);
   `'use server'` modules; symlinks and special files; empty diffs. Only then
   are the files copied (as regular 0644 files) into the trusted checkout,
   where anything git ignores is rejected, and the staged diff is checked for
   size (> `MAX_DIFF_LINES` changed text lines) and secrets.
5. **Format** — Prettier on changed files only, in the trusted checkout. This
   is the only local check left: lint, typecheck and the production build now
   run in CI against the exact pushed commit (see step 7) instead of a second
   local copy of the same checks in the worker's own scratch environment.
6. **PR** — commit in the trusted checkout, force-push the worker-owned
   branch, open (or update the open) PR against `main` **as a draft**
   (`openOrUpdatePull` sends `draft: true` on creation) — this happens
   _before_ CI is known to pass (see step 7), so unlike the old local-checks
   flow a commit that ultimately fails CI still gets an open PR, but draft
   status keeps it from looking mergeable until it's actually verified. The
   repository is public, so titles use only a generic label and request ID.
   The PR body contains the admin-only link, public changed files, and fixed
   checks—not private request fields, attachment names, or generated prose.
   Existing PRs are re-drafted before editing/pushing another revision;
   a failure to re-draft or promote is reported as `needs_attention`.
   Every outbound GitHub title/body/comment and the commit message pass a
   redaction filter (worker secrets, secret-shaped tokens, emails, phone
   numbers → `[redacted]`). Status → `verifying`.
7. **CI** — polls the GitHub Checks API for the exact pushed SHA until the
   validation job (`CI_CHECK_NAME`, default `Validate`) plus `Unit Tests`,
   `Change Request Agent Service`, and `Browser Flow Tests` all succeed.
   Missing/pending jobs keep waiting; skipped/neutral are not success.
   On failure: one repair
   round (agent again in the sandbox with the failing job's log as context →
   guardrails → format → re-commit → re-push → CI again). If it still fails,
   `needs_attention` — the PR is left open (and still draft — nothing marks
   it ready for review) with failing checks for a human to fix or close, it
   is not closed automatically.
8. **Preview** — polls GitHub Deployments for the Vercel `Preview`
   deployment of exactly the pushed SHA (`success` → `environment_url`). The
   URL must be `https://*.vercel.app`, otherwise `needs_attention` (PR stays
   draft).
9. **Verify** — Playwright Chromium, desktop 1280×900 and Pixel 5, production
   (`BASELINE_URL`) vs preview on `page_path`; screenshots around the picked
   element or the top of the page; checks HTTP < 400, no new uncaught page
   errors, picked element visible (advisory). The desktop capture also
   records a private `.webm` screen recording of the desktop preview load
   (Playwright `recordVideo`), uploaded alongside the screenshots. Recording
   capture/upload is required: failure blocks readiness even when the model's
   verdict passes. If `VERCEL_AUTOMATION_BYPASS_SECRET` is set, one request to the
   preview origin only sets Vercel's host-scoped bypass cookie (no global
   headers, so third-party requests never see the secret; the secret URL is
   never logged). Screenshots and the recording go to
   `requests/<id>/verification/<label>.{png,webm}` + `change_request_files`
   rows (both share `kind: 'verification'`, distinguished by `content_type`;
   see `db.ts`'s `uploadVerificationShot` doc comment). A second `claude -p`
   (Read only) judges the screenshots + the picked element's HTML → exactly
   one JSON object `{"verdict","summary"}` (optionally in one code fence;
   anything else → `unsure`). The stored `verification` is
   `{verdict, summary, checks, commit_sha}`. `pass` + hard checks OK →
   the draft PR from step 6 is marked ready for review, and only after that
   succeeds is `ready_for_review` stored (GitHub's GraphQL `markPullRequestReadyForReview`, the same
   mechanism `gh pr ready` uses — REST has no `draft` field on pull-request
   updates). Otherwise `needs_attention` and the PR stays draft. Verdict is
   commented on
   the PR (screenshots and the recording stay in the admin UI — the PR
   comment never shows raw video or request text, only the verdict + a link
   to `/admin/requests/<id>`).
10. **Notify** — Resend email on `ready_for_review` / `needs_attention`
    (logged instead when not configured; never fails the job).

Every failure ends in `needs_attention` with `error` and a system message.
SIGTERM stops claiming, kills the running child process, and requeues the
current request (or `needs_attention` after `MAX_ATTEMPTS`). Claims left in
`in_progress`/`verifying` by this `WORKER_ID` for longer than
`STALE_CLAIM_MINUTES` are requeued the same way. Logs are JSON lines on stdout.
Each maintenance cycle also deletes `submitting` rows older than 1 h (row first,
conditionally on still being `submitting`, then its objects) and sweeps
`requests/<uuid>/` Storage folders with no request row, removing objects older
than `ORPHAN_MIN_AGE_MINUTES` (max 50 folders per cycle; any listing/query
error skips the folder until the next cycle). It also finishes requests an
admin closed from the site (`status = 'closed'`, `github_cleanup_pending`):
closes the still-open PR with a generic public comment (never the private
reason), deletes the `change-request/*` branch, and clears the flag; a PR that
was already merged moves the request to `merged` instead. GitHub failures
leave the flag set for the next cycle.
The worker only ever claims `queued` requests; `submitting` rows (still being
written by the admin UI) are left alone.

**Maintenance under a bounded-trigger dispatch model** — a long-poll deploy
(`main()` looping with `POLL_INTERVAL_MS`, e.g. the persistent Coolify mode)
runs the maintenance cycle above (`recoverStaleClaims`, `syncPullRequests`,
`cleanupClosedRequests`, `cleanupStorage`) every `PR_SYNC_INTERVAL_MS` regardless of whether a request
is queued. A Family Host managed-agent run (`--once`) only runs the process at
all when something dispatches it, and only runs maintenance once, at startup,
before claiming — there is no idle-period loop to run it again later. This is
honest, not silently patched over: as long as a managed-agent run is
triggered often enough that a new run's startup maintenance runs within
`STALE_CLAIM_MINUTES` of any crash and within a reasonable time of any PR
being merged/closed on GitHub, behavior matches the long-poll deploy. If runs
become infrequent (e.g. only triggered by new change requests, and requests
are rare), a `ready_for_review`/`needs_attention` request whose PR was merged
or closed can sit un-synced, and a run that crashes mid-job leaves its claim
stale, until the next run happens to start.

**Scheduled trigger** —
`.github/workflows/change-request-agent-maintenance.yml` closes this gap
without any new scheduling platform: it POSTs to the same site-owned
automation endpoint the admin UI already calls
(`src/lib/change-request-agent.ts`'s `triggerChangeRequestAgent`,
`https://family.georgenijo.com/api/automation/agents/run`) every 20 minutes
(`cron: '7,27,47 * * * *'`, an off-the-hour minute), with no `request_id` —
it exists purely to make a fresh managed-agent run's startup maintenance
happen on a bounded cadence, not to process a specific request. This bounds
the staleness window above to roughly 20 minutes instead of "until the next
change request happens to arrive." Two honest limitations, not silently
patched over:

- GitHub Actions `schedule` triggers are best-effort — GitHub does not
  guarantee they fire exactly on time under load, and can skip a run
  entirely.
- GitHub automatically disables `schedule` triggers after 60 days with no
  activity (push/PR) on the repository's default branch. A long-quiet repo
  needs a manual `workflow_dispatch` run (or any push) to re-arm it; this
  workflow also exposes `workflow_dispatch` for that reason.

**Provisioning:** the workflow authenticates with the `FAMILY_HOST_AGENT_TRIGGER_TOKEN`
GitHub Actions repository secret (Settings → Secrets and variables → Actions)
— the _same_ narrowly-scoped token value already provisioned as the site's
`FAMILY_HOST_AGENT_TRIGGER_TOKEN` app environment variable (Vercel), copied
into both places. Nothing about the token's scope or issuance changes; this
only adds a second caller. If the secret is unset, the workflow logs a notice
and exits successfully (not a broken build) rather than failing CI.

## Security model and residual risk

- Request text is untrusted. The agent has file tools only, confined to a
  sandbox that contains no dependencies and no git metadata, so nothing it
  writes executes there.
- Trusted tooling (`npm ci`, Prettier, ESLint, tsc) runs only in the trusted
  checkout, which the agent never sees, and only over validated source files
  (`.ts/.tsx/.css` in allowed areas, static assets in `public/`) — no config
  files, dotfiles, `node_modules` writes, symlinks or server actions.
- Residual risk (reduced, not eliminated): lint, typecheck and the production
  build — the tools most likely to run a bug in a parser/linter/build plugin
  over agent-written `.ts/.tsx/.css` — now run in GitHub Actions CI against
  the exact pushed commit, not in the worker's own container (see step 7).
  The worker only reads CI's pass/fail result and job logs over the GitHub
  API; it never executes those tools itself. The one tool that still runs
  locally, Prettier (step 5), only reformats already-guardrailed files and
  never fails the job on error (a formatting error is left for CI's
  `format:check` to report). The pushed branch still builds on Vercel
  (preview only; nothing deploys to production without George merging).
- The Family Host managed-agent build itself (GHCR image via
  `.github/workflows/change-request-agent-image.yml`) also runs only on
  GitHub-hosted runners, with no cache exported and no secrets beyond the
  default `GITHUB_TOKEN` — the published image carries no private env vars,
  build cache, or request artifacts.
- Child processes that run repository code and Claude get a minimal
  environment: the Supabase service key, GitHub token and Resend key are
  never passed to them. The GitHub token reaches `git push` only via
  `GIT_CONFIG_*` env (never argv or `.git/config`).

## Environment

| Variable                                               | Required        | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                                         | yes             | Supabase project URL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `SUPABASE_SERVICE_ROLE_KEY`                            | yes             | Service-role key (claims, updates, Storage)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `GITHUB_TOKEN`                                         | yes (real runs) | Fine-grained token for this repo: Contents RW, Pull requests RW, Deployments R. Locally falls back to `gh auth token`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `ANTHROPIC_BASE_URL`                                   | container       | CPA gateway URL for the Claude CLI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY`          | container       | Gateway credential for the Claude CLI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `CLAUDE_CONFIG_DIR`                                    | no              | Claude CLI profile dir (passed through). Locally: `$HOME/.claude-cpa`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `CLAUDE_SETTINGS_FILE`                                 | no              | Settings file passed via `--settings` (needed for settings-based auth such as `apiKeyHelper`, since `--restricted` ignores user settings). Default: `$CLAUDE_CONFIG_DIR/settings.json` when it exists                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `CLAUDE_MODEL`                                         | no              | Default `claude-opus-5-5`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `CLAUDE_BIN`                                           | no              | Default `claude`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `CLAUDE_TIMEOUT_MS`                                    | no              | Per agent run, default 20 min                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `WORKER_ID`                                            | no              | Default `change-request-agent@<hostname>`. Set a stable value in the container so stale-claim recovery survives redeploys                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `WORK_DIR`                                             | no              | Clone location, default `/data/repo`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `GITHUB_REPO` / `REPO_URL` / `BASE_BRANCH`             | no              | Default `georgenijo/St-Basils-Rebuild`, its https URL, `main`. `GITHUB_REPO` wins if both are set; `GITHUB_REPOSITORY` (Family Host's name for the same setting) is the fallback                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `CHANGE_REQUEST_GIT_NAME` / `CHANGE_REQUEST_GIT_EMAIL` | no              | Commit author/committer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `FH_RUN_ID` / `FH_AGENT_ID`                            | no              | Family Host managed-agent run/agent id, when launched that way — log correlation only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `FH_CREDENTIAL_URL` / `FH_RUN_CREDENTIAL`              | no              | Family Host per-run GitHub token refresh endpoint (`{public_url}/api/agent-credentials/github`) + bearer credential for long runs (>50 min). When both are set the worker POSTs `Authorization: Bearer <FH_RUN_CREDENTIAL>` (no body) to `FH_CREDENTIAL_URL` on `FH_CREDENTIAL_REFRESH_INTERVAL_MS` and expects `{"token":"<jwt>","repository":"<owner/repo>","expires_at":"<ISO 8601>"}` back — confirmed against the broker handler (`family_host_server.py:2782` routes to `family_host.py`'s `refresh_agent_github_token`, not guessed; see `credential-refresh.ts`'s doc comment for the exact source lines). A mismatched `repository` is rejected rather than installed. |
| `FH_CREDENTIAL_REFRESH_INTERVAL_MS`                    | no              | Default 40 min                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `CI_CHECK_NAME`                                        | no              | Validation check name, default `Validate` (`ci:validate`). This check plus `Unit Tests`, `Change Request Agent Service`, and `Browser Flow Tests` must all succeed on the exact pushed commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `CI_TIMEOUT_MS` / `CI_POLL_MS`                         | no              | Default 15 min / 20 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `SITE_URL`                                             | no              | Admin links in emails, default `https://stbasilsboston.org`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `BASELINE_URL`                                         | no              | "Before" site, default `https://stbasilsboston.org`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `VERCEL_AUTOMATION_BYPASS_SECRET`                      | no              | Sent as `x-vercel-protection-bypass` to previews                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `RESEND_API_KEY`                                       | no              | Enables email notifications (see "Email notifications" below)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `CHANGE_REQUEST_NOTIFY_EMAIL`                          | no              | Recipient(s), comma separated                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `CHANGE_REQUEST_FROM_EMAIL`                            | no              | Default `St. Basil's Church <noreply@stbasilsboston.org>` (the site's sender)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `DRY_RUN`                                              | no              | `1`: stop after the local commit — print the diff, no push/PR, status `needs_attention` with error `dry run`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `POLL_INTERVAL_MS`                                     | no              | Claim poll, default 15000                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `PR_SYNC_INTERVAL_MS`                                  | no              | PR sync + stale recovery, default 5 min                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `LIVE_WAIT_MS`                                         | no              | how long a `--once` run waits before exiting for just-merged changes to reach production, default 10 min                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `STALE_CLAIM_MINUTES` / `MAX_ATTEMPTS`                 | no              | Default 90 / 3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `ORPHAN_MIN_AGE_MINUTES`                               | no              | Orphan Storage sweep only deletes objects older than this (default 30; 0 for testing)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `PREVIEW_TIMEOUT_MS` / `PREVIEW_POLL_MS`               | no              | Default 15 min / 20 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `CHECK_TIMEOUT_MS` / `NPM_CI_TIMEOUT_MS`               | no              | Default 10 min / 15 min. `CHECK_TIMEOUT_MS` now only bounds the local Prettier pass (lint/typecheck/build moved to CI — see `CI_TIMEOUT_MS`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `MAX_DIFF_LINES`                                       | no              | Default 800 (binary files excluded)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `LOG_LEVEL`                                            | no              | `debug` for debug lines                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## Running locally

```bash
cd services/change-request-agent
npm ci
# Local Supabase (never .env.local — it points at production):
eval "$(npx -y supabase@2.115.0 status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY)=' \
  | sed 's/^API_URL/export SUPABASE_URL/; s/^SERVICE_ROLE_KEY/export SUPABASE_SERVICE_ROLE_KEY/')"

# Dry run: process one queued request, no push/PR
WORK_DIR=/tmp/cra-work/repo DRY_RUN=1 CLAUDE_CONFIG_DIR=$HOME/.claude-cpa \
  npx tsx src/worker.ts --once

# Real run (pushes a branch and opens a PR)
WORK_DIR=/tmp/cra-work/repo CLAUDE_CONFIG_DIR=$HOME/.claude-cpa npx tsx src/worker.ts --once

# Verify step only, against an existing preview, for an existing request id
CLAUDE_CONFIG_DIR=$HOME/.claude-cpa npx tsx src/verify-cli.ts \
  --request <request-id> --preview https://<preview>.vercel.app [--sha <commit>] [--summary "..."] [--record]
```

Requires Node 22+ (supabase-js needs native WebSocket). Playwright needs Chromium: `npx playwright install chromium`.

Tests run from the repo root (`npm test` includes `services/*/src/**/*.test.ts`);
`npm run typecheck` here checks the service alone, and root lint/typecheck/
format also cover it.

## Deploying on Family Host

The same image supports two deployment modes; `CMD` and the presence of
`--once` on `argv` pick between them (see the Dockerfile's top comment).

### Persistent Coolify application (long-poll worker)

- Application from this repo, Dockerfile build, **base directory
  `services/change-request-agent`** (the Dockerfile's build context is this
  directory; the worker clones the website itself at runtime).
- Persistent volume mounted at `/data` (clone + `node_modules` survive
  redeploys). No ports / no public domain — it is a background worker.
- Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_TOKEN`,
  `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN` (CPA gateway), `WORKER_ID`
  (stable, e.g. `family-host`), optionally `RESEND_API_KEY`,
  `CHANGE_REQUEST_NOTIFY_EMAIL`, `VERCEL_AUTOMATION_BYPASS_SECRET`,
  `CLAUDE_MODEL`.
- Give it ≥ 2 GB RAM (Chromium + CI polling; no more local lint/typecheck/
  build) and a stop grace period of ~30 s so SIGTERM can requeue the running
  request.
- First job after a fresh volume clones the repo and runs `npm ci` (several
  minutes).
- Runs its own maintenance cycle (stale-claim recovery, PR-state sync,
  storage cleanup) every `PR_SYNC_INTERVAL_MS` regardless of load — the
  bounded-trigger caveat below does not apply to this mode.

### Family Host managed agent (ephemeral scratch, bounded trigger)

- Image: the public GHCR digest published by
  `.github/workflows/change-request-agent-image.yml` (GitHub-hosted runners
  only; build context `services/change-request-agent`; no cache exported, no
  secrets beyond the default `GITHUB_TOKEN`). **GHCR packages default to
  private even from a public repo** — after the first push, the package's
  visibility needs a one-time manual change (package settings → Change
  visibility → Public) before Family Host can pull it anonymously; this
  workflow cannot do that for itself.
- `LAUNCH.argv` (fully replaces the image's `CMD`, per
  managed-agents-contract.md): `["node", "src/worker.ts", "--once"]`. The
  Dockerfile sets `NODE_OPTIONS=--import=tsx` so the `tsx` loader still
  applies even though `argv` overrides `CMD`. Child processes (`npm ci`, git,
  Claude) do not inherit it; the website checkout does not install `tsx`.
  `/data`/`/artifacts` are job-owned scratch (not guaranteed to persist
  between runs) — every run does a fresh `git clone` + `npm ci`, so expect a
  clone the first job at every run, not just the first ever.
- Env: same as above, plus whatever the platform injects when a repository is
  configured (`GITHUB_TOKEN`, `GITHUB_REPOSITORY`, and — for runs expected to
  exceed ~50 min — `FH_CREDENTIAL_URL`/`FH_RUN_CREDENTIAL` for token
  refresh). `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN` are already forwarded
  by the platform.
- Bounded-trigger maintenance caveat: see "Maintenance under a
  bounded-trigger dispatch model" above — `recoverStaleClaims`/
  `syncPullRequests`/`cleanupStorage` only run once, at the start of each
  triggered run, not on an idle-period timer.

### Email notifications

The worker emails the notification recipients through Resend whenever a
request reaches a state that needs a person:

- `ready_for_review` — CI passed on the exact commit, the preview was
  verified, and the draft PR was marked ready (subject
  `Change request ready for review: <title>`).
- `needs_attention` — guardrail hit, agent or CI failure, failed or unsure
  verification, a restart during the request's last attempt, or a stale claim
  that used its last attempt (subject `Change request needs attention: <title>`).

Each email has the request title, status, verdict, what happened, and links to
the PR, preview, and `/admin/requests/<id>`. Requeues, merges, and closes do not
email. Sending never fails a job: a Resend error is logged as
`notification email failed` with the HTTP status.

Email is off unless both of these are set; otherwise each notification is only
logged as `notification (email not configured)`. The `worker started` log line
reports `emailNotifications: enabled` or which variable is missing (never the
values).

| Variable                      | Where (managed agent) | Value                                                                                                                                        |
| ----------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`              | sealed agent secret   | A Resend API key with sending access to the `stbasilsboston.org` domain (the website's sender domain). A separate key for the agent is best. |
| `CHANGE_REQUEST_NOTIFY_EMAIL` | agent env             | Recipient(s), comma separated.                                                                                                               |
| `CHANGE_REQUEST_FROM_EMAIL`   | agent env, optional   | Sender. Default `St. Basil's Church <noreply@stbasilsboston.org>`, the same sender the website uses; must be on a Resend-verified domain.    |
| `SITE_URL`                    | agent env, optional   | Base of the admin link in the email. Default `https://stbasilsboston.org`.                                                                   |

For the `st-basils-change-requests` managed agent, the key goes in as a sealed
secret read from stdin (never on the command line or in shell history):

```sh
family-host agent secret set st-basils-change-requests RESEND_API_KEY --value-file -
```

and `CHANGE_REQUEST_NOTIFY_EMAIL` (plus `CHANGE_REQUEST_FROM_EMAIL` if the
default sender is not wanted) goes in the agent's env. The next triggered run
picks them up. To check delivery, confirm the next run logs
`emailNotifications: enabled`, then `notification email sent` for a request
that ends ready for review and for one that ends needing attention.
