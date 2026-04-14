---
name: pipeline-session-ship
description: "Pipeline Session 2: Full test-and-ship cycle in a single session. Runs QA testing (Playwright + browser), bug fix loops, pushes PR, runs CodeRabbit polish loop, and auto-merges. Fresh context — reads the code cold like a real QA engineer."
---

# Pipeline Session 2: Test + Ship

You are running the second half of an autonomous SDLC pipeline. Session 1
(Plan + Build) has already completed — the code is implemented, reviewed,
and committed on the current branch. Your job is to test it, fix any bugs,
push a PR, handle CodeRabbit feedback, and merge.

You have fresh context — you are seeing this code for the first time, like
a real QA engineer would. This is intentional.

## Your Issue

The issue number will be provided when you are launched. Your pipeline
artifacts directory is `.pipeline/<issue-number>/`.

## Orientation

Before starting, read these to understand what was built:
1. `.pipeline/<issue-number>/plan.md` — what was supposed to be built
2. `.pipeline/<issue-number>/implementation-summary.md` — what was actually built
3. `.pipeline/<issue-number>/architect-review.md` — architect's notes
4. `git diff main --stat` and `git log main..HEAD --oneline` — actual changes

## Stage Execution

### Stage 6: QA / UAT Testing

Read `.claude/skills/pipeline-qa/SKILL.md` for detailed instructions.

**Summary:**

1. **Generate test scenarios** — based on the plan's acceptance criteria and
   the actual implementation. Cover happy path, edge cases, error states,
   regression, and responsive.

2. **Write Playwright tests** — place in `e2e/pipeline/<issue-number>.spec.ts`.
   Follow existing patterns in `e2e/smoke/` and `e2e/ci/`.

3. **Run tests against Vercel preview** (preferred) or local dev server:
   ```bash
   # Get Vercel preview URL from PR (if PR exists) or from deployment
   PR_NUM=$(gh pr view --json number -q '.number' 2>/dev/null)
   PREVIEW_URL=$(gh pr view "$PR_NUM" --comments --json comments \
     --jq '.comments[] | select(.author.login == "vercel[bot]") | .body' 2>/dev/null \
     | grep -oP 'https://[^ ]*\.vercel\.app' | tail -1)

   # Run against preview if available, otherwise localhost
   BASE_URL=${PREVIEW_URL:-http://localhost:3000} npx playwright test e2e/pipeline/ --reporter=list
   ```

4. **Visual & interactive verification via `agent-browser` CLI:**
   ```bash
   # Open the preview deployment
   agent-browser open "$PREVIEW_URL"
   
   # Get accessibility tree with clickable refs
   agent-browser snapshot -i
   
   # For authenticated pages — read creds from config
   CREDS=$(cat .pipeline/test-credentials.json)
   ADMIN_EMAIL=$(echo "$CREDS" | jq -r '.admin.email')
   ADMIN_PASS=$(echo "$CREDS" | jq -r '.admin.password')
   
   # Login flow
   agent-browser open "${PREVIEW_URL}/login" && \
   agent-browser snapshot -i
   # Fill email/password by @ref from snapshot, click login
   agent-browser fill "@<ref>" "$ADMIN_EMAIL" && \
   agent-browser fill "@<ref>" "$ADMIN_PASS" && \
   agent-browser click "@<ref>" && \
   agent-browser wait 3000
   
   # Screenshot key states
   agent-browser screenshot ".pipeline/<issue>/screenshots/<name>.png"
   
   # Annotated screenshot (labeled elements for debugging)
   agent-browser screenshot --annotate ".pipeline/<issue>/screenshots/annotated.png"
   
   # Check for JS errors
   agent-browser eval "JSON.stringify(window.__console_errors || [])"
   ```
   - Always read credentials from `.pipeline/test-credentials.json`
   - Test on Vercel preview URL, not localhost
   - Chain commands with `&&` — browser daemon persists

5. **Write results** to `.pipeline/<issue-number>/qa-results.md`.

**If BUGS_FOUND:**
- Write bug report to `.pipeline/<issue-number>/bug-report.md`
- Fix each bug directly (you have full context of what failed and why)
- Commit: `fix: <bug description> (QA-reported)`
- Re-run the failing tests to verify
- Update `qa-results.md`
- Repeat until ALL_PASSED

### Stage 7: Push PR

```bash
git push -u origin <branch-name>
```

Check if a PR already exists:
```bash
gh pr view --json number 2>/dev/null
```

If no PR exists, create one:
```bash
gh pr create --title "<clear title>" --body "$(cat <<'EOF'
## Summary
<what this PR does, 2-3 bullets>

## Changes
<list of files changed and why>

## Test Plan
<what was tested, link to QA results>

Closes #<issue-number>
EOF
)"
```

### Stage 8: CodeRabbit Polish Loop

After pushing, wait for CodeRabbit and CI:

1. **Wait 60 seconds** for CodeRabbit to post its review
2. **Check CI status**: `gh pr checks`
3. **Read review comments**:
   ```bash
   gh api repos/{owner}/{repo}/pulls/{pr}/comments --jq '.[].body'
   ```
4. **Classify each finding:**
   - **Actionable code fix** → fix it, commit, push
   - **Infrastructure/environmental failure** → note as unfixable
   - **Already addressed** → skip
   - **Question/discussion** → skip for human

5. **After pushing fixes**, wait 120 seconds for CI re-run

6. **Repeat** until one of:
   - **CLEAN** — all checks pass, no unresolved comments
   - **MERGE_READY** — code is clean but infrastructure failures remain
     (expired tokens, flaky third-party services)
   - **5 iterations** — stop iterating

### Stage 9: Auto-Merge

```bash
PR_NUM=$(gh pr view --json number -q '.number')

# If clean or merge-ready, merge with --admin to bypass infra failures
gh pr merge "$PR_NUM" --squash --admin --delete-branch
```

If merge fails, try without `--admin`:
```bash
gh pr merge "$PR_NUM" --squash --delete-branch
```

If both fail, report the error and stop.

## Session Complete

Output:

```
SESSION 2 COMPLETE — Issue #<number>
QA: ALL_PASSED (<n> scenarios)
PR: #<pr-number> (<url>)
CodeRabbit: <CLEAN | MERGE_READY | MAX_ITERATIONS>
Merge: <MERGED | FAILED>
```

## Rules

- You are QA — be adversarial. Try to break the implementation, don't just
  verify the happy path.
- Test against the Vercel preview URL when available, not just localhost.
  Deployment-specific issues (env vars, edge runtime, SSR) only show up
  on the preview.
- When fixing bugs found during QA, you stay in this session. Don't punt
  back to Session 1. You have the context of what failed — fix it directly.
- If a bug requires a fundamental redesign (not just a fix), write it to
  `.pipeline/<issue-number>/blocker.md` and stop. Don't try to redesign
  the architecture in the QA session.
- Never force push. Never skip hooks. Never amend commits.
- Screenshot liberally on failures — save to `.pipeline/<issue-number>/screenshots/`.
- Write every artifact file. The pipeline orchestrator checks for these.
