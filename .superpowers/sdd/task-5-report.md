# Task 5 report: automation worker lease, retry, and compensation

## Status

Implemented and verified. Commit includes only Task 5 production files, focused tests, and this report.

## Implemented behavior

- Atomically claims eligible `running`/`compensating` executions with a 60-second owner lease, `nextAttemptAt`, and expired-lease takeover.
- Renews the lease immediately before every adapter call and releases it using an owner-filtered repository update after each claimed tick.
- Runs actions in plan order with stable execute keys and compensates successful actions in reverse order with stable compensation keys.
- Persists running and terminal attempts, including execute results required for later compensation.
- Retries only errors explicitly classified transient, with bounded exponential durable backoff; terminal execute failures transition to compensation.
- Resumes from durable attempts without repeating successful execution or compensation.
- Marks completed workflows `succeeded`/`rolled_back`; terminal compensation failure becomes `compensation_failed` and invokes the high-priority alert hook.
- Polling is bounded and non-overlapping; stop cancels future polling and awaits active work.
- Server constructs the worker from the initialized database, starts it after indexes/bootstrap/realtime prerequisites, and awaits worker stop on SIGTERM. Task 6 remains responsible for registering real adapters; no fake adapter is installed.

## TDD evidence

- Inherited RED: the focused suite originally failed 3 of 8 tests because the worker retained its 60-second lease, blocking the next compensation/retry tick, and the overlap test raced before adapter entry. The feature was initially absent as recorded in the Task 5 brief (`missing worker`).
- Additional RED coverage added for durable transient compensation retry/backoff and explicit foreign-lease exclusion/expired takeover/release. The overlap test was changed to await a deterministic adapter-entry signal.
- GREEN focused: `npm test -- --run backend/test/automation-worker.test.ts` — 10/10 tests passed.
- Backend build: `npm run build:backend` — exit 0.
- Full suite: `npm test -- --run` — 22 files, 126 tests passed.
- `git diff --check` — exit 0.

## Files

- `backend/src/modules/automation/automation.model.ts`
- `backend/src/modules/automation/automation.repository.ts`
- `backend/src/modules/automation/automation.worker.ts`
- `backend/test/automation-worker.test.ts`
- `backend/src/server.ts`
- `.superpowers/sdd/task-5-report.md`

## Concerns / follow-up

- Error classification currently treats only errors carrying `transient: true` as retryable; validation, permission, and other permanent errors are terminal by default.
- The worker deliberately starts with the action registry potentially empty. With no executable rules/actions before Task 6 registration this is safe; Task 6 must register adapters before production executions are created.

## Reviewer-finding follow-up

- RED: four added regression tests failed: unregistered adapter lookup rejected the tick; a rejected claim escaped as an unhandled rejection and polling stopped; alert rejection escaped; and a never-resolving alert blocked the tick until timeout.
- Adapter lookup now occurs inside the durable attempt failure path. An unregistered action is recorded as a permanent failed attempt and transitions execution to `compensating`.
- Polling catches and reports tick failures through an injected non-throwing `onError` hook and schedules the next bounded timer in `finally`; the server wires this hook to `automation_worker_error` logging.
- Terminal compensation state and attempt are persisted before alerting. Alert delivery is best-effort and bounded by an injectable timeout, with rejection reported but never allowed to undo durable progress or block shutdown indefinitely.
- Reviewer GREEN focused: `npm test -- --run backend/test/automation-worker.test.ts` — 14/14 passed with no unhandled errors.
- Reviewer verification: `npm run build:backend` exited 0; `npm test -- --run` passed 22 files and 130 tests.
