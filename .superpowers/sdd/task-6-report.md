# Task 6 report: concrete action adapters

Implemented all eight automation action adapters with strict config validation, side-effect-free previews, policy sensitivity, stable idempotency propagation, and action-specific compensation safeguards.

Production wiring uses a durable `automation_action_effects` claim/result store. Mongo-backed task mutations capture prior values and use `updatedAt` compare-and-set filters for execution and rollback. GitHub reviewer/comment operations use installation credentials through `resolveGithubToken`; notifications and corrections are durable internal records; retries and operations alerts use durable collections. Registration occurs before the automation worker starts.

TDD evidence:

- RED: focused suite initially failed because action modules were absent.
- RED: production effect test failed because `production-deps` was absent.
- GREEN: `npx vitest run backend/test/automation-actions.test.ts backend/test/automation-service.test.ts` — 17/17 tests passed.
- Build: `npm run build:backend` — exit 0.
- Full: `npm test -- --run` — 23 files, 137/137 tests passed.

Scoped files:

- `backend/src/modules/automation/actions/task.actions.ts`
- `backend/src/modules/automation/actions/github.actions.ts`
- `backend/src/modules/automation/actions/notification.actions.ts`
- `backend/src/modules/automation/actions/operations.actions.ts`
- `backend/src/modules/automation/actions/register-actions.ts`
- `backend/src/modules/automation/actions/production-deps.ts`
- `backend/src/core/database.ts`
- `backend/src/server.ts`
- `backend/test/automation-actions.test.ts`
- `backend/test/automation-service.test.ts`

## Follow-up correctness hardening

- Namespaced every durable effect by operation purpose so execute and compensation cannot reuse results.
- Replaced insert/delete claims with owner leases and `running`, `completed`, and fail-safe `ambiguous` states. Duplicate claimants wait, stale leases are reclaimable, completion writes require a matched owner, and ambiguous outcomes create durable manual-verification alerts without repeating side effects.
- Added durable GitHub reviewer user/team snapshots before mutation, add/remove diffs, and delete/edit/correction comment rollback fallback based on actual API failures.
- Added canonical GitHub target validation plus strict IDs, values, channels, messages, labels, priorities, assignees, reviewers, and job IDs.
- Required a real dead-letter source for `job.retry` and made registration registry-state-driven and reset-compatible.
- Follow-up focused verification: 13/13 tests passed; lease races, namespace separation, stale recovery, ambiguous completion, reviewer partial failure, fallback, validation, and reset registration are covered.

## Reviewer restore and lease heartbeat follow-up

- Split reviewer effects into `github.reviewers.apply` and `github.reviewers.restore`. Apply captures users and teams and diffs the current state to the desired state; restore fetches current state and diffs back to the persisted snapshot.
- Added operation identity and an injected heartbeat to renew live effect leases. Completion and ambiguity transitions use operation-identity compare-and-set filters, heartbeat cleanup is guaranteed, and ambiguity persistence/alerts are best-effort so they cannot mask the original error.
- Added filter-honoring concurrency coverage proving an operation that outlives its original lease cannot be reclaimed while its heartbeat is live.
- Added a production execute/compensate GitHub test proving both users and teams are restored and the apply/restore effect namespaces are distinct.
- Empty task update changes are rejected.
