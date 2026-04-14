---
name: pr-polish
description: Monitor a PR for CI failures and review comments (CodeRabbit, human reviewers), fix issues, re-commit and push. Designed to run via /loop after PR creation. Stops after 5 iterations or when clean.
---

# PR Polish Loop

You are in post-PR mode. Your job is to monitor CI and code review comments,
fix every actionable issue, and push until the PR is clean.

## State tracking

Track iteration count in `/tmp/.pr-polish-state.json`:
```json
{ "pr": <number>, "iteration": <n>, "max": 5 }
```

- On first run for a PR, create the file with iteration=1.
- On each subsequent run, increment iteration.
- If iteration > 5, STOP. Report what's still unresolved and let the human take over.
- If the PR number changes, reset the state.

## Workflow

### Step 1: Identify the PR

```bash
gh pr view --json number,url,headRefName -q '.'
```

If no PR is found on the current branch, stop — nothing to polish.

### Step 2: Check CI status

```bash
gh pr checks
```

- If checks are still **pending**, report "CI still running, will check next loop" and exit this iteration. The /loop scheduler will retry.
- If checks are all **passing**, move to Step 3.
- If checks have **failures**, collect the logs:

```bash
gh run view <run-id> --log-failed | tail -100
```

Categorize each failure:
- **Fixable** (lint, typecheck, test assertion, build error) → queue for fixing
- **Environmental** (timeout, flaky infra, rate limit) → skip and note
- **Unrelated to this PR** (pre-existing failure on main) → skip and note

### Step 3: Collect review comments

Get ALL unresolved review comments from every reviewer:

```bash
gh api repos/{owner}/{repo}/pulls/{pr}/comments --jq '.[] | select(.position != null) | {id: .id, path: .path, line: .line, body: .body, user: .user.login, created_at: .created_at}'
```

Also check the review-level comments:

```bash
gh api repos/{owner}/{repo}/pulls/{pr}/reviews --jq '.[] | select(.state == "CHANGES_REQUESTED" or .state == "COMMENTED") | {id: .id, user: .user.login, state: .state, body: .body}'
```

For each comment:
- **Actionable fix request** → queue for fixing
- **Question or discussion** → skip, note for human
- **Nitpick you disagree with** → skip, note reasoning
- **Already addressed in a prior iteration** → skip

### Step 4: Fix issues

For each queued issue (CI failure or review comment):

1. Read the relevant source file(s)
2. Understand the root cause — don't just patch symptoms
3. Apply the fix
4. Verify locally:
   ```bash
   npm run lint && npx tsc --noEmit
   ```
5. If the fix involves test failures, run the specific test:
   ```bash
   npm test -- --reporter=verbose <test-file>
   ```

### Step 5: Commit and push

- Stage only the specific files you changed (never `git add -A` or `git add .`)
- One commit per logical fix — don't bundle unrelated changes
- Commit message format: `fix: <what was fixed>` — reference the reviewer if addressing a comment
- Push: `git push`

### Step 5.5: Verify on Vercel preview deployment

After pushing, get the Vercel preview URL for this PR:

```bash
gh pr view --json url,number -q '.number'
# Then get the deployment URL from Vercel
gh api repos/{owner}/{repo}/deployments --jq '.[0].payload.web_url // empty' 2>/dev/null
# Or extract from PR comments — Vercel bot posts the preview link
gh pr view <number> --comments --json comments --jq '.comments[] | select(.author.login == "vercel[bot]") | .body' | grep -oP 'https://[^ ]*\.vercel\.app' | tail -1
```

Once you have the preview URL, run Playwright smoke tests against it:

```bash
BASE_URL=<preview-url> npx playwright test e2e/smoke/ --reporter=list 2>&1
```

Also use browser automation to visually verify the deployment:
1. Navigate to the preview URL
2. Check that pages load without errors
3. Verify any UI changes from this PR render correctly
4. Check the browser console for JavaScript errors

If smoke tests or visual verification fail on the preview:
- These are **real bugs** — the code is deployed and broken
- Fix them before moving to the next polish iteration
- Commit the fix with: `fix: <what broke on preview>`

If the Vercel deployment is still building or the preview URL isn't available yet,
note it and check again next iteration.

### Step 6: Report

After pushing (or if nothing to fix), output a status summary:

```
## PR Polish — Iteration N/5

### Fixed
- [file:line] description of fix (source: CodeRabbit / CI / @reviewer)

### Skipped
- [reason] description

### Still pending
- CI re-running, will check next iteration

### Status: WAITING / CLEAN / NEEDS_HUMAN / MERGE_READY
```

- **WAITING**: Pushed fixes, CI needs to re-run. Loop will continue.
- **CLEAN**: All checks pass, no unresolved comments. Done.
- **NEEDS_HUMAN**: Hit max iterations or found issues that require human judgment.
- **MERGE_READY**: All code issues are fixed, but unfixable infrastructure/environmental
  failures remain (e.g., broken GitHub Actions secrets, flaky third-party services,
  misconfigured tokens). The PR is as clean as it can get from code changes alone.

### When to report MERGE_READY

Report MERGE_READY when ALL of these are true:
1. No unresolved review comments that need code changes
2. CodeRabbit has no outstanding findings
3. All code-level CI checks pass (lint, typecheck, unit tests, build)
4. The only remaining failures are infrastructure/environmental:
   - GitHub Actions secrets or token issues
   - Third-party service timeouts (Vercel preview auth, Lighthouse runner)
   - Flaky tests that fail on infra, not on code (network timeouts, rate limits)
   - Pre-existing failures also present on main branch

When reporting MERGE_READY, write a state file so the pipeline can detect it:
```bash
echo '{"status": "MERGE_READY", "pr": <number>, "unfixable": ["<failure 1>", "<failure 2>"]}' > /tmp/.pr-polish-state.json
```

Also include in the report:
```
### Unfixable (infrastructure)
- <failure name> — <why it can't be fixed by code changes>
- <suggested fix for the human — e.g., "Update VERCEL_TOKEN in repo secrets">
```

Do NOT burn additional iterations waiting on failures you've already classified
as unfixable. If iteration 1 identifies all remaining failures as infrastructure,
report MERGE_READY immediately — don't wait for iteration 2.

## Rules

- Never force push
- Never skip pre-commit hooks (--no-verify)
- Never amend existing commits — always create new ones
- If a fix might break something else, run the full test suite, not just lint
- Don't touch files outside the scope of the PR's changeset unless a fix requires it
- If you're unsure whether a review comment needs a code change or just a reply, skip it for human review
- Respect the iteration limit. 5 rounds is enough — if it's not clean by then, something needs human eyes
- Classify failures early. If a CI failure is clearly infrastructure (token errors,
  third-party timeouts, secrets misconfiguration), don't wait multiple iterations
  hoping it fixes itself — report MERGE_READY and let the human handle infra
