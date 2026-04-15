# Wave Execution Plan (revised 2026-04-14)

## Summary
- Issues: 3
- Waves: 2
- Peak parallelism: 2 (wave 1)
- Prior wave plan stale — #180 now CLOSED, #184 mid-flight, #186 still blocked.

## Dependency Graph
```
#184 ──→ #186 (BLOCKED: treasurer approval)
#210 (standalone)
```

## Wave 1: Ship #184 + #210
| Issue | Title | Depends On | Complexity |
|-------|-------|-----------|-----------|
| #184 | Transactional notification emails | — (all deps CLOSED) | high |
| #210 | Clarify subscriber vs user signup flow | — | medium |

**#184 status** — implementation already committed on branch `issue/184-transactional-notification-emails` (17 commits ahead of main; templates, notification helper, cron, settings page, Playwright tests all present). No PR yet. `pipeline-session-build` will resume via `pipeline-assess` and short-circuit to ship.

**#210** — design/clarification issue, options to "consider". Planner must pick an approach. Likely: public newsletter form + auto-subscribe invited users + admin cross-link. Confirm with user before implementing.

## Wave 2: #186 — BLOCKED
| Issue | Title | Depends On | Complexity |
|-------|-------|-----------|-----------|
| #186 | Integrate Every.org | #184 | high |

**SKIP with note.** Treasurer must approve Every.org's fiscal-intermediary model (tax receipts issued via Every.org, not directly from St. Basil's) before any code is written. External human decision. Givebutter is documented fallback.

## Risks
- #210 underspecified — risk of building wrong thing without user direction.
- #184 ship may surface CodeRabbit/CI noise; ship session has polish loop, acceptable.

## Recommendations
- Run wave 1 issues **sequentially**: ship #184 first (on current branch), then switch to new branch for #210.
- Ask user which #210 option to implement before spawning session.
- Defer #186 until treasurer decision captured as comment on the issue.
