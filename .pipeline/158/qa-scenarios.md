# QA Scenarios — Issue #158: Member portal: Family tab

## Route & Rendering

| ID  | Scenario                                                  | Type       | Expected                              |
| --- | --------------------------------------------------------- | ---------- | ------------------------------------- |
| S1  | /member/family loads without server error                 | Happy path | Status < 500                          |
| S2  | /member/family shows family content or redirects to login | Happy path | URL contains /member/family or /login |
| S3  | No console errors on /member/family                       | Regression | No JS errors in console               |

## Page Content (Unauthenticated / Redirect)

| ID  | Scenario                                                    | Type       | Expected                          |
| --- | ----------------------------------------------------------- | ---------- | --------------------------------- |
| S4  | Unauthenticated user is redirected away from /member/family | Auth guard | Redirected to /login or auth page |

## Responsive

| ID  | Scenario                                          | Type       | Expected                        |
| --- | ------------------------------------------------- | ---------- | ------------------------------- |
| S5  | /member/family loads on mobile viewport (375x667) | Responsive | Status < 500, no console errors |

## Regression — Sibling Routes

| ID  | Scenario                       | Type       | Expected     |
| --- | ------------------------------ | ---------- | ------------ |
| S6  | /member overview still loads   | Regression | Status < 500 |
| S7  | /member/membership still loads | Regression | Status < 500 |

## Regression — Public Pages

| ID  | Scenario                     | Type       | Expected                      |
| --- | ---------------------------- | ---------- | ----------------------------- |
| S8  | Homepage (/) still loads     | Regression | Status 200, no console errors |
| S9  | Events (/events) still loads | Regression | Status 200, no console errors |
| S10 | About (/about) still loads   | Regression | Status 200, no console errors |
| S11 | Giving (/giving) still loads | Regression | Status 200, no console errors |

## Code Quality

| ID  | Scenario                           | Type         | Expected           |
| --- | ---------------------------------- | ------------ | ------------------ |
| S12 | TypeScript compiles without errors | Code quality | tsc --noEmit clean |
| S13 | ESLint passes on all new files     | Code quality | No lint errors     |

## Notes

- Authenticated-only tests (edit panel, add member, remove member) cannot be run without test credentials / seeded data.
- The slide-out panels, server actions, and RLS behavior require an authenticated session with a seeded family. These are validated via code review and TypeScript compilation.
