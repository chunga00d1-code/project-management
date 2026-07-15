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
