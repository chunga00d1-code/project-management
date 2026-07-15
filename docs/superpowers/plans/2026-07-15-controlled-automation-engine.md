# Controlled Automation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng automation engine theo sự kiện, chỉ superadmin cấu hình, có dry run, phê duyệt bắt buộc, thực thi idempotent và rollback/bù trừ tự động.

**Architecture:** Module `automation` sở hữu domain model, rule evaluator, planner, execution repository, worker và action registry. MongoDB giữ trạng thái bền vững; audit hiện có phát domain event vào engine; worker lease đảm bảo phục hồi và chạy một lần về mặt hiệu ứng. API Express và màn hình React dành riêng cho superadmin quản lý rule, approval và execution timeline.

**Tech Stack:** Node.js 20+, TypeScript 5.9, Express 5, MongoDB 6, React 19, TanStack Query 5, SSE/Redis hiện có, Vitest 3.

## Global Constraints

- Chỉ `superadmin` được tạo, sửa, publish, bật/tắt rule và phê duyệt execution.
- Không hỗ trợ script tùy ý, AI tự bật rule, workflow lồng nhau hoặc marketplace trong phiên bản đầu.
- Approval áp dụng cho toàn bộ execution plan trước khi action đầu tiên tạo side effect.
- MongoDB là nguồn sự thật; Redis chỉ hỗ trợ phân phối và realtime.
- Mọi action phải khai báo validation, mức nhạy cảm, execute và compensate.
- Một cặp `eventId + ruleVersionId` chỉ tạo tối đa một execution.
- Action và compensation phải idempotent; execution phải tiếp tục an toàn sau khi worker restart.
- Automation không được chặn luồng xử lý thủ công hiện có.

---

## File Map

- `backend/src/modules/automation/automation.model.ts`: toàn bộ domain types và state transitions.
- `backend/src/modules/automation/automation.validation.ts`: parse/validate input rule từ API.
- `backend/src/modules/automation/condition-evaluator.ts`: đánh giá cây điều kiện thuần túy.
- `backend/src/modules/automation/action-registry.ts`: registry và contract cho action adapters.
- `backend/src/modules/automation/automation.repository.ts`: MongoDB persistence, optimistic state updates và worker lease.
- `backend/src/modules/automation/automation.service.ts`: rule lifecycle, dry run và execution planning.
- `backend/src/modules/automation/automation.worker.ts`: execute, retry, compensation và recovery.
- `backend/src/modules/automation/automation.router.ts`: superadmin API.
- `backend/src/modules/automation/automation-events.service.ts`: chuẩn hóa audit/scheduler/integration failure thành event envelope.
- `backend/test/automation-*.test.ts`: unit/integration tests theo từng ranh giới.
- `frontend/src/features/automation/Automation.tsx`: shell, tabs và data fetching.
- `frontend/src/features/automation/RuleForm.tsx`: biểu mẫu trigger/condition/action.
- `frontend/src/features/automation/ExecutionTimeline.tsx`: approval và timeline.
- `frontend/src/types/automation.ts`: API contracts phía frontend.

---

### Task 1: Domain model, validation và condition evaluator

**Files:**
- Create: `backend/src/modules/automation/automation.model.ts`
- Create: `backend/src/modules/automation/automation.validation.ts`
- Create: `backend/src/modules/automation/condition-evaluator.ts`
- Test: `backend/test/automation-domain.test.ts`

**Interfaces:**
- Consumes: `ValidationError`, `object`, `text` từ `backend/src/core/validation.ts`.
- Produces: `AutomationRule`, `AutomationEvent`, `ExecutionPlan`, `AutomationExecution`, `parseRuleInput(value)`, `matchesConditions(root, context)`.

- [ ] **Step 1: Viết test thất bại cho điều kiện, validation và transition**

```ts
import { describe, expect, it } from "vitest";
import { matchesConditions } from "../src/modules/automation/condition-evaluator.js";
import { parseRuleInput } from "../src/modules/automation/automation.validation.js";

describe("automation domain", () => {
  it("evaluates nested AND/OR conditions", () => {
    const root = { operator: "and" as const, children: [
      { field: "task.priority", comparator: "eq" as const, value: "high" },
      { operator: "or" as const, children: [
        { field: "task.status", comparator: "eq" as const, value: "blocked" },
        { field: "task.daysOverdue", comparator: "gte" as const, value: 2 },
      ] },
    ] };
    expect(matchesConditions(root, { task: { priority: "high", status: "todo", daysOverdue: 3 } })).toBe(true);
  });

  it("rejects an action without registered compensation semantics", () => {
    expect(() => parseRuleInput({ name: "Bad", scope: { type: "system" }, trigger: { type: "task.updated" }, conditions: { operator: "and", children: [] }, actions: [{ type: "shell.run", config: {} }] })).toThrow("Unsupported automation action");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run backend/test/automation-domain.test.ts`

Expected: FAIL vì các module automation chưa tồn tại.

- [ ] **Step 3: Tạo domain types và evaluator tối thiểu**

```ts
// automation.model.ts
export type TriggerType = "pr.opened" | "pr.updated" | "pr.merged" | "pr.closed" | "pr.review_changed" | "task.created" | "task.updated" | "task.status_changed" | "task.due_soon" | "task.overdue" | "integration.failed" | "schedule.tick";
export type ActionType = "task.create" | "task.update" | "task.assign" | "github.assign_reviewer" | "github.comment" | "notification.send" | "job.retry" | "operations.alert";
export type Comparator = "eq" | "neq" | "in" | "contains" | "gt" | "gte" | "lt" | "lte" | "exists";
export type ConditionNode = { operator: "and" | "or"; children: ConditionNode[] } | { field: string; comparator: Comparator; value?: unknown };
export interface RuleAction { id: string; type: ActionType; config: Record<string, unknown>; approvalRequired?: boolean; retry: { maxAttempts: number; baseDelayMs: number } }
export interface AutomationRule { _id: string; versionId: string; version: number; name: string; description?: string; enabled: boolean; priority: number; scope: { type: "system" | "repository" | "project" | "team"; id?: string }; trigger: { type: TriggerType }; conditions: ConditionNode; actions: RuleAction[]; effectiveFrom?: string; effectiveUntil?: string; createdBy: string; createdAt: string; publishedAt?: string }
export interface AutomationEvent { eventId: string; type: TriggerType; source: "audit" | "github" | "scheduler" | "operations"; occurredAt: string; actor?: string; scope: { repository?: string; projectId?: string; team?: string }; payload: Record<string, unknown>; automation?: { executionId: string; sourceRuleId: string; depth: number } }
export type ExecutionStatus = "planned" | "waiting_approval" | "running" | "succeeded" | "rejected" | "cancelled" | "expired" | "compensating" | "rolled_back" | "compensation_failed";
export interface PlannedAction extends RuleAction { sensitive: boolean; compensationType: string; preview: Record<string, unknown> }
export interface ExecutionPlan { actions: PlannedAction[]; requiresApproval: boolean; inputFingerprint: string }
export interface ActionAttempt { actionId: string; attempt: number; status: "running" | "succeeded" | "failed" | "compensated" | "compensation_failed"; startedAt: string; completedAt?: string; result?: Record<string, unknown>; error?: string }
export interface AutomationExecution { _id: string; eventId: string; ruleId: string; ruleVersionId: string; status: ExecutionStatus; event: AutomationEvent; plan: ExecutionPlan; attempts: ActionAttempt[]; approval?: { decidedBy: string; decidedAt: string; decision: "approved" | "rejected"; inputFingerprint: string }; lease?: { owner: string; until: Date }; createdAt: string; updatedAt: string }
```

```ts
// condition-evaluator.ts
import type { ConditionNode } from "./automation.model.js";
const read = (source: Record<string, unknown>, path: string) => path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, source);
export function matchesConditions(node: ConditionNode, context: Record<string, unknown>): boolean {
  if ("operator" in node) return node.operator === "and" ? node.children.every((child) => matchesConditions(child, context)) : node.children.some((child) => matchesConditions(child, context));
  const actual = read(context, node.field); const expected = node.value;
  switch (node.comparator) {
    case "eq": return actual === expected; case "neq": return actual !== expected;
    case "in": return Array.isArray(expected) && expected.includes(actual);
    case "contains": return Array.isArray(actual) ? actual.includes(expected) : typeof actual === "string" && typeof expected === "string" && actual.includes(expected);
    case "gt": return Number(actual) > Number(expected); case "gte": return Number(actual) >= Number(expected);
    case "lt": return Number(actual) < Number(expected); case "lte": return Number(actual) <= Number(expected);
    case "exists": return expected === false ? actual === undefined : actual !== undefined;
  }
}
```

`parseRuleInput` phải whitelist đúng `TriggerType`/`ActionType`, giới hạn tên 120 ký tự, tối đa 50 node điều kiện, 20 action, `maxAttempts` từ 1–8 và `baseDelayMs` từ 1000–3600000.

- [ ] **Step 4: Chạy test domain**

Run: `npx vitest run backend/test/automation-domain.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/automation backend/test/automation-domain.test.ts
git commit -m "feat: add automation domain model and evaluator"
```

### Task 2: Action registry và execution planner

**Files:**
- Create: `backend/src/modules/automation/action-registry.ts`
- Create: `backend/src/modules/automation/automation-planner.ts`
- Test: `backend/test/automation-planner.test.ts`

**Interfaces:**
- Consumes: `RuleAction`, `AutomationEvent`, `ExecutionPlan` từ Task 1.
- Produces: `ActionAdapter`, `registerAction(adapter)`, `getAction(type)`, `planExecution(rule, event)`.

- [ ] **Step 1: Viết test thất bại cho sensitivity và plan fingerprint**

```ts
import { expect, it } from "vitest";
import { planExecution } from "../src/modules/automation/automation-planner.js";
it("requires approval when any action is sensitive", async () => {
  const plan = await planExecution(ruleWith("github.comment"), event);
  expect(plan.requiresApproval).toBe(true);
  expect(plan.actions[0].sensitive).toBe(true);
  expect(plan.inputFingerprint).toMatch(/^[a-f0-9]{64}$/);
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run backend/test/automation-planner.test.ts`

Expected: FAIL vì planner chưa tồn tại.

- [ ] **Step 3: Tạo registry contract và planner**

```ts
export interface ActionContext { event: AutomationEvent; executionId: string; idempotencyKey: string }
export interface ActionAdapter {
  type: ActionType;
  sensitive: boolean;
  validate(config: Record<string, unknown>): void;
  preview(config: Record<string, unknown>, event: AutomationEvent): Promise<Record<string, unknown>>;
  execute(config: Record<string, unknown>, context: ActionContext): Promise<Record<string, unknown>>;
  compensate(config: Record<string, unknown>, result: Record<string, unknown>, context: ActionContext): Promise<Record<string, unknown>>;
}
const registry = new Map<ActionType, ActionAdapter>();
export const registerAction = (adapter: ActionAdapter) => registry.set(adapter.type, adapter);
export function getAction(type: ActionType) { const adapter = registry.get(type); if (!adapter) throw new Error(`Unsupported automation action: ${type}`); return adapter; }
```

Planner gọi `validate` và `preview` cho từng action, đặt `sensitive = adapter.sensitive || action.approvalRequired === true`, rồi hash JSON ổn định của event payload và previews bằng SHA-256.

- [ ] **Step 4: Chạy test planner**

Run: `npx vitest run backend/test/automation-planner.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/automation backend/test/automation-planner.test.ts
git commit -m "feat: add automation action registry and planner"
```

### Task 3: MongoDB repository, indexes và rule lifecycle

**Files:**
- Create: `backend/src/modules/automation/automation.repository.ts`
- Create: `backend/src/modules/automation/automation.service.ts`
- Modify: `backend/src/core/database.ts`
- Test: `backend/test/automation-service.test.ts`

**Interfaces:**
- Consumes: Task 1 types, `planExecution` từ Task 2, `database()`.
- Produces: `AutomationRepository`, `AutomationService.createDraft`, `.publish`, `.setEnabled`, `.dryRun`, `.ingest`.

- [ ] **Step 1: Viết test repository/service với dependency injection**

```ts
it("creates one execution for an event and immutable rule version", async () => {
  const service = new AutomationService(fakeRepository, fakePlanner);
  await service.ingest(event);
  await service.ingest(event);
  expect(fakeRepository.executions).toHaveLength(1);
  expect(fakeRepository.executions[0].ruleVersionId).toBe("rule-1:v1");
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run backend/test/automation-service.test.ts`

Expected: FAIL vì repository/service chưa tồn tại.

- [ ] **Step 3: Thêm indexes**

Thêm vào `ensureIndexes()`:

```ts
db.collection("automation_rule_versions").createIndex({ ruleId: 1, version: 1 }, { unique: true }),
db.collection("automation_rules").createIndex({ enabled: 1, "trigger.type": 1, priority: -1 }),
db.collection("automation_executions").createIndex({ eventId: 1, ruleVersionId: 1 }, { unique: true }),
db.collection("automation_executions").createIndex({ status: 1, "lease.until": 1, updatedAt: 1 }),
db.collection("automation_events").createIndex({ eventId: 1 }, { unique: true }),
db.collection("automation_events").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
```

- [ ] **Step 4: Implement repository và service**

Repository dùng constructor nhận `Db`, các update trạng thái có filter trạng thái hiện tại, và `insertExecution` bắt duplicate key để trả execution hiện có. `publish` ghi snapshot bất biến vào `automation_rule_versions`; `automation_rules` chỉ giữ con trỏ phiên bản hiện hành. `dryRun` gọi evaluator/planner nhưng không ghi execution và không gọi adapter execute.

- [ ] **Step 5: Chạy test service và database regression**

Run: `npx vitest run backend/test/automation-service.test.ts backend/test/validation.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/core/database.ts backend/src/modules/automation backend/test/automation-service.test.ts
git commit -m "feat: persist automation rules and executions"
```

### Task 4: Approval API và superadmin authorization

**Files:**
- Create: `backend/src/modules/automation/automation.router.ts`
- Modify: `backend/src/server.ts`
- Test: `backend/test/automation-router.test.ts`

**Interfaces:**
- Consumes: `authenticate`, `authorize("superadmin")`, `AutomationService`.
- Produces endpoints dưới `/api/automation`.

- [ ] **Step 1: Viết route tests**

```ts
it("denies admin access to automation rules", async () => {
  const response = await request(app).get("/api/automation/rules").set(adminToken);
  expect(response.status).toBe(403);
});
it("rejects stale approval fingerprints", async () => {
  const response = await request(app).post("/api/automation/executions/e1/approve").set(superadminToken).send({ inputFingerprint: "old" });
  expect(response.status).toBe(409);
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run backend/test/automation-router.test.ts`

Expected: FAIL vì router chưa tồn tại.

- [ ] **Step 3: Tạo router với endpoint rõ ràng**

```ts
automationRouter.use(authenticate, authorize("superadmin"));
automationRouter.get("/rules", listRules);
automationRouter.post("/rules", createDraft);
automationRouter.post("/rules/:id/publish", publishRule);
automationRouter.patch("/rules/:id/enabled", setEnabled);
automationRouter.post("/rules/:id/dry-run", dryRun);
automationRouter.get("/executions", listExecutions);
automationRouter.get("/executions/:id", getExecution);
automationRouter.post("/executions/:id/approve", approveExecution);
automationRouter.post("/executions/:id/reject", rejectExecution);
automationRouter.post("/executions/:id/cancel", cancelExecution);
automationRouter.post("/executions/:id/retry-compensation", retryCompensation);
```

`approveExecution` bắt buộc body chứa fingerprint trùng plan hiện tại; nếu không trả 409 và yêu cầu lập lại plan. Mọi mutation gọi `audit()` với action `automation.*`.

- [ ] **Step 4: Mount router trong server**

```ts
import { automationRouter } from "./modules/automation/automation.router.js";
app.use("/api/automation", automationRouter);
```

- [ ] **Step 5: Chạy route tests**

Run: `npx vitest run backend/test/automation-router.test.ts backend/test/permissions.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/server.ts backend/src/modules/automation/automation.router.ts backend/test/automation-router.test.ts
git commit -m "feat: add superadmin automation API"
```

### Task 5: Worker lease, retry và automatic compensation

**Files:**
- Create: `backend/src/modules/automation/automation.worker.ts`
- Modify: `backend/src/server.ts`
- Test: `backend/test/automation-worker.test.ts`

**Interfaces:**
- Consumes: `AutomationRepository.claimNext(owner, leaseMs)`, `getAction(type)`.
- Produces: `AutomationWorker.start()`, `.stop()`, `.tick()`.

- [ ] **Step 1: Viết worker tests bằng fake clock và fake repository**

```ts
it("compensates successful actions in reverse order", async () => {
  await worker.tick();
  expect(calls).toEqual(["execute:a", "execute:b", "execute:c", "compensate:b", "compensate:a"]);
  expect(repository.execution.status).toBe("rolled_back");
});
it("marks compensation_failed after bounded retries", async () => {
  await worker.tick();
  expect(repository.execution.status).toBe("compensation_failed");
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run backend/test/automation-worker.test.ts`

Expected: FAIL vì worker chưa tồn tại.

- [ ] **Step 3: Implement state machine**

`tick()` phải:

1. Claim một execution `running` hoặc `compensating` bằng lease 60 giây.
2. Gia hạn lease trước mỗi adapter call.
3. Dùng idempotency key `${executionId}:${actionId}:execute` hoặc `:compensate`.
4. Ghi attempt trước và sau side effect.
5. Chỉ retry transient error tới `maxAttempts`, với `nextAttemptAt` bền vững.
6. Khi execute hết retry, chuyển atomically sang `compensating`.
7. Compensate action thành công theo thứ tự ngược.
8. Kết thúc ở `rolled_back` hoặc `compensation_failed`.

- [ ] **Step 4: Start/stop worker trong server lifecycle**

```ts
await automationWorker.start();
process.on("SIGTERM", () => { automationWorker.stop(); /* existing shutdown */ });
```

- [ ] **Step 5: Chạy worker tests và typecheck**

Run: `npx vitest run backend/test/automation-worker.test.ts && npm run typecheck`

Expected: PASS và typecheck exit 0.

- [ ] **Step 6: Commit**

```bash
git add backend/src/server.ts backend/src/modules/automation/automation.worker.ts backend/test/automation-worker.test.ts
git commit -m "feat: execute and compensate automation plans"
```

### Task 6: Concrete action adapters

**Files:**
- Create: `backend/src/modules/automation/actions/task.actions.ts`
- Create: `backend/src/modules/automation/actions/github.actions.ts`
- Create: `backend/src/modules/automation/actions/notification.actions.ts`
- Create: `backend/src/modules/automation/actions/operations.actions.ts`
- Create: `backend/src/modules/automation/actions/register-actions.ts`
- Test: `backend/test/automation-actions.test.ts`

**Interfaces:**
- Consumes: `TaskService`, GitHub App/token services, notification service, retry queue, `ActionAdapter`.
- Produces registered adapters cho toàn bộ `ActionType` ở Task 1.

- [ ] **Step 1: Viết contract tests cho từng adapter**

Mỗi adapter test phải xác nhận: invalid config bị reject; preview không gọi integration; execute dùng idempotency key; compensate khôi phục snapshot cũ hoặc tạo correction record.

```ts
it("task.update restores the previous task snapshot", async () => {
  const result = await adapter.execute({ taskId: "t1", patch: { priority: "high" } }, context);
  await adapter.compensate({}, result, context);
  expect(tasks.get("t1")?.priority).toBe("medium");
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run backend/test/automation-actions.test.ts`

Expected: FAIL vì adapters chưa tồn tại.

- [ ] **Step 3: Implement adapters và compensation semantics**

- Task create → compensate bằng xóa task nếu task chưa bị người dùng sửa; nếu đã sửa, tạo cảnh báo conflict.
- Task update/assign → result lưu previous snapshot; compensate dùng compare-and-set trên version.
- GitHub assign reviewer → compensate khôi phục reviewer set trước đó.
- GitHub comment → xóa/sửa comment nếu API cho phép; nếu không, đăng correction liên kết comment gốc.
- Notification send → gửi correction notification tham chiếu message gốc.
- Job retry → không thể thu hồi job đã chạy; compensate tạo operations alert nêu kết quả cần kiểm tra.
- Operations alert → compensate đánh dấu alert resolved với lý do rollback.

- [ ] **Step 4: Đăng ký adapters một lần khi server khởi động**

```ts
export function registerAutomationActions(deps: AutomationActionDependencies) {
  for (const adapter of [...taskActions(deps), ...githubActions(deps), ...notificationActions(deps), ...operationsActions(deps)]) registerAction(adapter);
}
```

- [ ] **Step 5: Chạy action tests**

Run: `npx vitest run backend/test/automation-actions.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/automation/actions backend/test/automation-actions.test.ts
git commit -m "feat: add compensated automation actions"
```

### Task 7: Event ingestion, scheduler và loop protection

**Files:**
- Create: `backend/src/modules/automation/automation-events.service.ts`
- Modify: `backend/src/core/audit.service.ts`
- Modify: `backend/src/modules/webhooks/webhook.router.ts`
- Modify: `backend/src/modules/jobs/retry-queue.service.ts`
- Modify: `backend/src/modules/notifications/deadline-scheduler.service.ts`
- Test: `backend/test/automation-events.test.ts`

**Interfaces:**
- Consumes: audit actions, GitHub delivery ID, task metadata và failure metadata.
- Produces: `publishAutomationEvent(input)`, `automationMetadata(execution)`.

- [ ] **Step 1: Viết tests cho normalization, dedupe và depth limit**

```ts
it("does not re-trigger the source rule", async () => {
  await events.publish({ ...event, automation: { executionId: "e1", sourceRuleId: "r1", depth: 1 } });
  expect(repository.created.map((item) => item.ruleId)).not.toContain("r1");
});
it("rejects automation chains deeper than five", async () => {
  await expect(events.publish({ ...event, automation: { executionId: "e5", sourceRuleId: "r5", depth: 5 } })).resolves.toMatchObject({ blocked: true });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run backend/test/automation-events.test.ts`

Expected: FAIL vì event service chưa tồn tại.

- [ ] **Step 3: Implement event envelope và mappings**

Map audit `task.create`, `task.update`, `task.status` sang trigger tương ứng. GitHub dùng delivery ID cộng action làm `eventId`. Failure event dùng job/delivery ID cộng attempt. Scheduler tạo bucket ID theo phút/ngày để việc chạy lại không tạo event trùng. Đặt TTL event 30 ngày và depth tối đa 5.

- [ ] **Step 4: Nối event publishing theo best-effort**

Sau khi nghiệp vụ và audit thành công, gọi `publishAutomationEvent`. Nếu engine lỗi, ghi warning nhưng không làm request thủ công thất bại. Với webhook, giữ nguyên response và dedupe hiện có.

- [ ] **Step 5: Chạy event và webhook regression tests**

Run: `npx vitest run backend/test/automation-events.test.ts backend/test/webhook-signature.test.ts backend/test/deadline-datetime.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/core/audit.service.ts backend/src/modules/automation/automation-events.service.ts backend/src/modules/webhooks/webhook.router.ts backend/src/modules/jobs/retry-queue.service.ts backend/src/modules/notifications/deadline-scheduler.service.ts backend/test/automation-events.test.ts
git commit -m "feat: ingest automation events from platform activity"
```

### Task 8: Realtime events và operations metrics

**Files:**
- Modify: `backend/src/modules/realtime/realtime.service.ts`
- Modify: `backend/src/modules/realtime/realtime.policy.ts`
- Modify: `backend/src/modules/jobs/operations.router.ts`
- Test: `backend/test/automation-realtime.test.ts`

**Interfaces:**
- Consumes: execution state changes.
- Produces: event types `automation.execution_updated`, `automation.approval_required`, `automation.compensation_failed`; metrics endpoint `/api/operations/automation`.

- [ ] **Step 1: Viết policy và metrics tests**

```ts
it("only exposes automation events to superadmin", () => {
  expect(canReceiveRealtimeEvent(event, superadminContext)).toBe(true);
  expect(canReceiveRealtimeEvent(event, adminContext)).toBe(false);
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run backend/test/automation-realtime.test.ts`

Expected: FAIL vì event types/policy chưa hỗ trợ automation.

- [ ] **Step 3: Thêm event types, policy và metrics aggregation**

Metrics trả `{ waitingApproval, running, succeeded24h, rolledBack24h, compensationFailed, oldestPendingAt }`. Endpoint operations automation cũng phải dùng `authorize("superadmin")`, không kế thừa quyền admin hiện có.

- [ ] **Step 4: Chạy realtime tests**

Run: `npx vitest run backend/test/automation-realtime.test.ts backend/test/realtime-policy.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/realtime backend/src/modules/jobs/operations.router.ts backend/test/automation-realtime.test.ts
git commit -m "feat: expose automation realtime status and metrics"
```

### Task 9: Superadmin automation UI

**Files:**
- Create: `frontend/src/types/automation.ts`
- Create: `frontend/src/features/automation/Automation.tsx`
- Create: `frontend/src/features/automation/RuleForm.tsx`
- Create: `frontend/src/features/automation/ExecutionTimeline.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/hooks/usePermission.ts`
- Modify: `frontend/src/styles/app.css`
- Test: `frontend/src/__tests__/automation.test.tsx`

**Interfaces:**
- Consumes: `/api/automation/*`, realtime invalidation pattern hiện có.
- Produces: trang `automation` chỉ hiển thị cho superadmin.

- [ ] **Step 1: Viết UI tests**

```tsx
it("shows Automation navigation only to superadmin", () => {
  localStorage.setItem("user", JSON.stringify({ email: "root@example.com", role: "superadmin" }));
  render(<App />);
  expect(screen.getByRole("button", { name: /tự động hóa/i })).toBeInTheDocument();
});
it("requires preview before publishing a rule", async () => {
  render(<RuleForm rule={draft} />);
  expect(screen.getByRole("button", { name: /xuất bản/i })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: /chạy thử/i }));
  expect(await screen.findByText(/cần phê duyệt/i)).toBeVisible();
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run frontend/src/__tests__/automation.test.tsx`

Expected: FAIL vì UI chưa tồn tại.

- [ ] **Step 3: Thêm permission và navigation**

Mở rộng permission union với `automation`; chỉ map `superadmin: [..., "automation"]`. Thêm page `automation` trong `App.tsx`, nav label `Tự động hóa`, và guard render bằng `hasPermission(user.role, "automation")`.

- [ ] **Step 4: Implement rule form**

Form hỗ trợ name/description, scope, trigger, cây AND/OR, ordered actions, approval badge và failure policy. Không cho publish cho đến khi dry run thành công trên đúng draft revision. Hiển thị validation error ngay tại trường.

- [ ] **Step 5: Implement approval queue và execution timeline**

Approval dialog hiển thị fingerprint, preview từng action và cảnh báo dữ liệu nguồn thay đổi. Timeline hiển thị attempts, retry, compensation và nút retry compensation chỉ ở `compensation_failed`.

- [ ] **Step 6: Kết nối SSE invalidation**

Khi nhận `automation.*`, invalidate queries `automation-rules`, `automation-executions`, `automation-metrics`; polling 60 giây vẫn là fallback.

- [ ] **Step 7: Chạy UI tests và build frontend**

Run: `npx vitest run frontend/src/__tests__/automation.test.tsx && npm run build:frontend`

Expected: PASS và Vite build exit 0.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types/automation.ts frontend/src/features/automation frontend/src/App.tsx frontend/src/hooks/usePermission.ts frontend/src/styles/app.css frontend/src/__tests__/automation.test.tsx
git commit -m "feat: add superadmin automation console"
```

### Task 10: End-to-end verification, documentation và rollout guard

**Files:**
- Modify: `backend/src/config/env.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Create: `backend/test/automation-e2e.test.ts`
- Modify: `docs/superpowers/specs/2026-07-15-controlled-automation-engine-design.md` only if verification exposes a clarified contract.

**Interfaces:**
- Consumes: toàn bộ Tasks 1–9.
- Produces: feature flag `AUTOMATION_ENABLED`, verified rollout path và operator documentation.

- [ ] **Step 1: Viết E2E tests với in-memory adapters và Mongo test fixture**

Các case bắt buộc: event tạo đúng một execution; approval stale bị reject; approved execution thành công; action thứ ba lỗi làm action hai rồi một được compensate; restart tiếp tục lease hết hạn; compensation failure tạo cảnh báo; dry run không tạo side effect.

- [ ] **Step 2: Chạy E2E để xác nhận các thiếu sót**

Run: `npx vitest run backend/test/automation-e2e.test.ts`

Expected: FAIL cho tới khi wiring và lifecycle hoàn chỉnh.

- [ ] **Step 3: Thêm feature flag và shutdown wiring**

```ts
automationEnabled: process.env.AUTOMATION_ENABLED === "true",
automationPollMs: Number(process.env.AUTOMATION_POLL_MS || 2000),
automationLeaseMs: Number(process.env.AUTOMATION_LEASE_MS || 60000),
```

Validate poll từ 250–60000 ms và lease từ 10000–300000 ms. Khi flag false, API rule vẫn cho xem nhưng không ingest/run execution; UI hiển thị trạng thái tắt.

- [ ] **Step 4: Viết README rollout**

Tài liệu phải hướng dẫn: chạy với `AUTOMATION_ENABLED=false`; tạo rule và dry run; bật ở một instance; theo dõi metrics/approval/compensation; bật toàn cụm; rollback bằng cách tắt flag mà không xóa execution/audit.

- [ ] **Step 5: Chạy toàn bộ quality gates**

Run: `npm test`

Expected: tất cả Vitest suites PASS.

Run: `npm run typecheck`

Expected: exit 0, không TypeScript error.

Run: `npm run lint`

Expected: exit 0, không warning.

Run: `npm run build`

Expected: frontend và backend build thành công.

- [ ] **Step 6: Kiểm tra diff và secret**

Run: `git diff --check && git status --short && git diff -- .env`

Expected: không whitespace error; `.env` không thay đổi; chỉ còn các file có chủ đích.

- [ ] **Step 7: Commit**

```bash
git add backend/src/config/env.ts .env.example README.md backend/test/automation-e2e.test.ts
git commit -m "feat: complete controlled automation engine rollout"
```

---

## Spec Coverage Checklist

- Rule form, scopes, versioning, dry run: Tasks 1–4, 9.
- Event sources PR/task/failure/schedule: Task 7.
- Approval before side effects and stale-plan protection: Tasks 2, 4, 9.
- Idempotency, lease and restart recovery: Tasks 3, 5, 7, 10.
- Retry, reverse compensation và compensation failure: Tasks 5, 6, 10.
- Audit, realtime, monitoring và alerts: Tasks 4, 7, 8, 9.
- Superadmin-only access: Tasks 4, 8, 9.
- Rollout without breaking manual workflows: Tasks 7, 10.

