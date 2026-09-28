# change-request-agent

Worker that turns website change requests from `/admin/requests` into verified
pull requests. Contract: [`docs/change-requests.md`](../../docs/change-requests.md).
**It never merges.** George merges; Vercel deploys on merge.

## What it does

One request at a time:

1. **Claim** — `claim_next_change_request(worker_id)` (service role), polling every 15 s.
   Every `PR_SYNC_INTERVAL_MS` it also requeues stale claims and syncs PR state
   (`ready_for_review`/`needs_attention` with a PR → `merged` / `closed`).
2. **Prepare** — persistent clone in `WORK_DIR`; per job `git fetch origin main`,
   branch `change-request/<id8>-<title-slug>` from `origin/main`, clean tree
   (keeps `node_modules`; `npm ci` only when `package-lock.json` changed).
   Attachments are copied to `public/images/requests/<id8>/<safe-name>`.
3. **Agent** — `claude -p --restricted` in the checkout with only
   `Read,Edit,Write,Glob,Grep` (no shell, no web, no subagents; file tools
   confined to the checkout; no MCP; no session persistence). The prompt marks
   all request text and the thread as untrusted data. `NEEDS_CLARIFICATION: …`
   → agent message + `needs_attention`, no PR.
4. **Guardrails** — changed files from `git status --porcelain` (incl.
   untracked); unreferenced attachments removed; reject paths outside
   `src/app/(public)/**`, `src/components/**`, `public/**`,
   `src/app/globals.css`, empty diffs, > `MAX_DIFF_LINES` changed text lines,
   or diffs containing a worker secret / secret-shaped token.
5. **Checks** — Prettier on changed files, `npm run lint`, `npm run typecheck`;
   one agent repair round on failure, then `needs_attention`.
6. **PR** — commit, force-push the worker-owned branch, open (or update the
   open) PR against `main`. The body has no requester identity.
   Status → `verifying`.
7. **Preview** — polls GitHub Deployments for the commit's Vercel `Preview`
   deployment (`success` → `environment_url`).
8. **Verify** — Playwright Chromium, desktop 1280×900 and Pixel 5, production
   (`BASELINE_URL`) vs preview on `page_path`; screenshots the picked element
   (padded) or the top of the page; checks HTTP < 400, no new uncaught page
   errors, picked element visible (advisory). PNGs go to
   `requests/<id>/verification/<label>.png` + `change_request_files` rows.
   A second `claude -p` (Read only) judges the screenshots → strict JSON
   verdict (anything unparseable → `unsure`). `pass` + hard checks OK →
   `ready_for_review`, otherwise `needs_attention`. Verdict is commented on
   the PR (screenshots stay in the admin UI).
9. **Notify** — Resend email on `ready_for_review` / `needs_attention`
   (logged instead when not configured; never fails the job).

Every failure ends in `needs_attention` with `error` and a system message.
SIGTERM stops claiming, kills the running child process, and requeues the
current request (or `needs_attention` after `MAX_ATTEMPTS`). Claims left in
`in_progress`/`verifying` by this `WORKER_ID` for longer than
`STALE_CLAIM_MINUTES` are requeued the same way. Logs are JSON lines on stdout.

Child processes that run repository code (`npm ci`, lint, typecheck,
Prettier) and Claude get a minimal environment: the Supabase service key,
GitHub token and Resend key are never passed to them. The GitHub token reaches
`git push` only via `GIT_CONFIG_*` env (never argv or `.git/config`).

## Environment

| Variable                                               | Required        | Meaning                                                                                                                                                                                               |
| ------------------------------------------------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                                         | yes             | Supabase project URL                                                                                                                                                                                  |
| `SUPABASE_SERVICE_ROLE_KEY`                            | yes             | Service-role key (claims, updates, Storage)                                                                                                                                                           |
| `GITHUB_TOKEN`                                         | yes (real runs) | Fine-grained token for this repo: Contents RW, Pull requests RW, Deployments R. Locally falls back to `gh auth token`                                                                                 |
| `ANTHROPIC_BASE_URL`                                   | container       | CPA gateway URL for the Claude CLI                                                                                                                                                                    |
| `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY`          | container       | Gateway credential for the Claude CLI                                                                                                                                                                 |
| `CLAUDE_CONFIG_DIR`                                    | no              | Claude CLI profile dir (passed through). Locally: `$HOME/.claude-cpa`                                                                                                                                 |
| `CLAUDE_SETTINGS_FILE`                                 | no              | Settings file passed via `--settings` (needed for settings-based auth such as `apiKeyHelper`, since `--restricted` ignores user settings). Default: `$CLAUDE_CONFIG_DIR/settings.json` when it exists |
| `CLAUDE_MODEL`                                         | no              | Default `claude-opus-5-5`                                                                                                                                                                             |
| `CLAUDE_BIN`                                           | no              | Default `claude`                                                                                                                                                                                      |
| `CLAUDE_TIMEOUT_MS`                                    | no              | Per agent run, default 20 min                                                                                                                                                                         |
| `WORKER_ID`                                            | no              | Default `change-request-agent@<hostname>`. Set a stable value in the container so stale-claim recovery survives redeploys                                                                             |
| `WORK_DIR`                                             | no              | Clone location, default `/data/repo`                                                                                                                                                                  |
| `GITHUB_REPO` / `REPO_URL` / `BASE_BRANCH`             | no              | Default `georgenijo/St-Basils-Rebuild`, its https URL, `main`                                                                                                                                         |
| `CHANGE_REQUEST_GIT_NAME` / `CHANGE_REQUEST_GIT_EMAIL` | no              | Commit author/committer                                                                                                                                                                               |
| `SITE_URL`                                             | no              | Admin links in emails, default `https://stbasilsboston.org`                                                                                                                                           |
| `BASELINE_URL`                                         | no              | "Before" site, default `https://stbasilsboston.org`                                                                                                                                                   |
| `VERCEL_AUTOMATION_BYPASS_SECRET`                      | no              | Sent as `x-vercel-protection-bypass` to previews                                                                                                                                                      |
| `RESEND_API_KEY`                                       | no              | Enables email notifications                                                                                                                                                                           |
| `CHANGE_REQUEST_NOTIFY_EMAIL`                          | no              | Recipient(s), comma separated                                                                                                                                                                         |
| `CHANGE_REQUEST_FROM_EMAIL`                            | no              | Default `St. Basil's Church <noreply@stbasilsboston.org>` (the site's sender)                                                                                                                         |
| `DRY_RUN`                                              | no              | `1`: stop after the local commit — print the diff, no push/PR, status `needs_attention` with error `dry run`                                                                                          |
| `POLL_INTERVAL_MS`                                     | no              | Claim poll, default 15000                                                                                                                                                                             |
| `PR_SYNC_INTERVAL_MS`                                  | no              | PR sync + stale recovery, default 5 min                                                                                                                                                               |
| `STALE_CLAIM_MINUTES` / `MAX_ATTEMPTS`                 | no              | Default 90 / 3                                                                                                                                                                                        |
| `PREVIEW_TIMEOUT_MS` / `PREVIEW_POLL_MS`               | no              | Default 15 min / 20 s                                                                                                                                                                                 |
| `CHECK_TIMEOUT_MS` / `NPM_CI_TIMEOUT_MS`               | no              | Default 10 min / 15 min                                                                                                                                                                               |
| `MAX_DIFF_LINES`                                       | no              | Default 800 (binary files excluded)                                                                                                                                                                   |
| `LOG_LEVEL`                                            | no              | `debug` for debug lines                                                                                                                                                                               |

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
  --request <request-id> --preview https://<preview>.vercel.app [--summary "..."] [--record]
```

Playwright needs Chromium: `npx playwright install chromium`.

Tests run from the repo root (`npm test` includes `services/*/src/**/*.test.ts`);
`npm run typecheck` here checks the service alone, and root lint/typecheck/
format also cover it.

## Deploying on Family Host

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
- Give it ≥ 2 GB RAM (Next.js lint/typecheck + Chromium) and a stop grace
  period of ~30 s so SIGTERM can requeue the running request.
- First job after a fresh volume clones the repo and runs `npm ci` (several
  minutes).
