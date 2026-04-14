---
name: pipeline-session-build
description: "Pipeline Session 1: Full plan-and-build cycle in a single session. Runs context gathering, tech planning, architect review (loops until approved), implementation, and code review (loops until approved). All in one Opus 4.6 context window."
---

# Pipeline Session 1: Plan + Build

You are running the first half of an autonomous SDLC pipeline for a single
GitHub issue. You will execute 5 stages sequentially in this one session,
maintaining full context across all stages.

## Your Issue

The issue number will be provided when you are launched. Your pipeline
artifacts directory is `.pipeline/<issue-number>/`.

## Stage Execution

Execute each stage in order. After completing each stage, write the artifact
file, then immediately proceed to the next stage. Do not stop between stages.

### Stage 1: Context Gathering

Read `.claude/skills/pipeline-context/SKILL.md` for detailed instructions.

**Summary:** Fetch the GitHub issue, explore the codebase, DB schema, related
files, existing patterns. Write output to `.pipeline/<issue-number>/context.md`
and save the raw issue to `.pipeline/<issue-number>/issue.json`.

### Stage 2: Tech Planning

Read `.claude/skills/pipeline-planner/SKILL.md` for detailed instructions.

**Summary:** Using your context from Stage 1, create a detailed implementation
plan with file targets, step-by-step instructions, verification commands, and
acceptance criteria. Write output to `.pipeline/<issue-number>/plan.md`.

### Stage 3: Architect Review

Read `.claude/skills/pipeline-architect/SKILL.md` for detailed instructions.

**Summary:** Review your own plan with the rigor of a principal architect.
Load `prompts/PROMPT_CHAT.md` for the project's architecture map and decision
principles. Evaluate correctness, architecture alignment, database design,
security, implementation quality, and risk.

Write output to `.pipeline/<issue-number>/architect-review.md`.

**If REJECTED:** Go back to Stage 2. Revise the plan addressing every rejection
point. Add a `## Revision Notes` section. Then re-run Stage 3. Loop until
the plan is APPROVED.

### Stage 4: Implementation

Read `.claude/skills/pipeline-implement/SKILL.md` for detailed instructions.

**Summary:** Execute the approved plan step by step. For each step:
1. Read the target files
2. Implement exactly what the plan describes
3. Verify with the step's verify command
4. Commit atomically with a clear message

After all steps, run `npm run lint && npx tsc --noEmit` and fix any issues
you introduced.

Write output to `.pipeline/<issue-number>/implementation-summary.md`.

### Stage 5: Code Review

Read `.claude/skills/pipeline-code-review/SKILL.md` for detailed instructions.

**Summary:** Review your own implementation against the plan. Check for
correctness, security (especially RLS policies), database safety, TypeScript
conventions, and performance. Be honest — if you find bugs, flag them.

Write output to `.pipeline/<issue-number>/code-review.md`.

**If CHANGES_REQUESTED:** Fix each critical finding, commit the fix, then
re-run the review. Loop until APPROVED.

## Session Complete

When code review is APPROVED, output:

```
SESSION 1 COMPLETE — Issue #<number>
Plan: APPROVED (iteration <n>)
Implementation: <n> commits
Code Review: APPROVED
Ready for Session 2 (QA + Ship)
```

Then stop. Session 2 will pick up from here with fresh context.

## Rules

- Execute all stages sequentially in this one session. Do not stop between
  stages unless a stage fails after 3 retries.
- Write every artifact file. The pipeline orchestrator checks for these files
  to determine progress.
- When reviewing your own work (architect review, code review), be genuinely
  critical. The point of the review stages is to catch real problems, not
  rubber-stamp your own work.
- Commit after each implementation step, not at the end.
- Never use `git add -A` or `git add .` — stage specific files only.
- Never amend commits or force push.
- If you hit an unrecoverable error (e.g., a dependency doesn't exist),
  write the error to `.pipeline/<issue-number>/blocker.md` and stop.
