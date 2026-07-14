# Responsive manual QA matrix

Status: **NOT RUN**. This environment did not provide an interactive browser or native responsive screenshot inspection. No cell is marked PASS without visual inspection.

## Resume checkpoint — 2026-07-14

- Branch: `feat/responsive-design-system`
- Automated implementation through Task 9 is committed.
- Verified: 117/117 tests, typecheck, lint, build, accessibility suite, and `git diff --check` pass.
- Task reviews 1–8 are approved. Task 9 automated changes have no reported code defect.
- Remaining required gate: execute all 72 manual viewport cells below and record browser/version, fixture, inspector, date, and issue links for failures.
- After the matrix is complete: rerun the four quality gates, perform whole-branch review, then choose merge/PR handling.

For every cell, run `npm run dev:frontend`, open the named surface in browser responsive mode at the exact viewport, and verify: no page-level horizontal overflow; primary action visible; keyboard focus visible; long Vietnamese and technical values readable; loading/empty/error states usable; drawer/overlay closes correctly; and 200% zoom does not hide controls. Use valid local seed or mock fixtures for normal, long, empty, and error states; do not infer results from jsdom.

| Route / surface | 320×568 | 375×812 | 768×1024 | 1024×768 | 1440×900 | 1920×1080 |
| --- | --- | --- | --- | --- | --- | --- |
| Landing EN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Landing VI | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Login | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Overview | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Tasks board | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Create task | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Edit task | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Task detail | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Projects | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Users | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Settings | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Operations | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |

Record the browser/version, data fixture, inspector, date, and any issue link when replacing a cell with PASS or FAIL.