# Repository Task Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make GitHub App-synced repositories the sole task scope, populate assignees from repository collaborators, and schedule tasks with start and deadline datetimes.

**Architecture:** A focused GitHub collaborator service fetches and caches normalized repository collaborators using installation tokens. Project and task routes enforce repository access and collaborator membership, while React forms consume the new endpoint and send UTC ISO timestamps. Legacy task fields remain readable, but current create/edit interfaces stop writing them.

**Tech Stack:** Node.js 20+, Express 5, TypeScript 5.9, MongoDB, React 19, TanStack Query, Vitest, GitHub REST API

## Global Constraints

- Repository records come only from GitHub App installation synchronization.
- Collaborators are loaded on demand and cached in process for five minutes.
- GitHub credentials never reach the browser.
- Empty assignee means `Chưa giao` and remains valid when GitHub is unavailable.
- `startAt` and `dueAt` are UTC ISO timestamps; `dueAt` must be later than `startAt`.
- New task UI and payloads do not contain `sprint`, `team`, or `dueDate`.
- Legacy `dueDate`, `sprint`, and `team` remain readable for backward compatibility.

---

### Task 1: GitHub collaborator service

**Files:**
- Create: `backend/src/modules/github-app/collaborator.service.ts`
- Create: `backend/test/github-collaborators.test.ts`

**Interfaces:**
- Consumes: `getInstallationToken(installationId: number): Promise<string>`.
- Produces: `GitHubCollaborator`, `listRepositoryCollaborators(repositoryFullName, installationId, options?)`, and `isRepositoryCollaborator(...)`.

- [ ] **Step 1: Write failing pagination and normalization tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { listRepositoryCollaborators } from "../src/modules/github-app/collaborator.service.js";

it("paginates, normalizes, deduplicates, and sorts collaborators", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(Array.from({ length: 100 }, (_, index) => ({ login: `user-${index}`, avatar_url: `https://avatars/${index}` }))), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify([{ login: "user-1", avatar_url: "duplicate" }, { login: "alice", avatar_url: "https://avatars/alice" }]), { status: 200 }));
  const result = await listRepositoryCollaborators("acme/widgets", 42, { fetcher, token: "token", bypassCache: true });
  expect(result[0]).toMatchObject({ login: "alice", avatarUrl: "https://avatars/alice" });
  expect(result.filter((item) => item.login === "user-1")).toHaveLength(1);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- backend/test/github-collaborators.test.ts`
Expected: FAIL because `collaborator.service.ts` does not exist.

- [ ] **Step 3: Implement the service and five-minute cache**

```ts
export interface GitHubCollaborator { login: string; name?: string; avatarUrl: string; }
type Options = { fetcher?: typeof fetch; token?: string; bypassCache?: boolean };
const cache = new Map<string, { expiresAt: number; items: GitHubCollaborator[] }>();

export async function listRepositoryCollaborators(repositoryFullName: string, installationId: number, options: Options = {}) {
  const cached = cache.get(repositoryFullName);
  if (!options.bypassCache && cached && cached.expiresAt > Date.now()) return cached.items;
  const token = options.token || await getInstallationToken(installationId);
  const fetcher = options.fetcher || fetch;
  const raw: { login: string; avatar_url: string }[] = [];
  for (let page = 1; ; page += 1) {
    const response = await fetcher(`https://api.github.com/repos/${repositoryFullName}/collaborators?per_page=100&page=${page}`, { headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(`GitHub collaborators HTTP ${response.status}`);
    const batch = await response.json() as typeof raw;
    raw.push(...batch);
    if (batch.length < 100) break;
  }
  const items = [...new Map(raw.map((item) => [item.login.toLowerCase(), { login: item.login, avatarUrl: item.avatar_url }])).values()].sort((a, b) => a.login.localeCompare(b.login));
  cache.set(repositoryFullName, { expiresAt: Date.now() + 300_000, items });
  return items;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- backend/test/github-collaborators.test.ts`
Expected: PASS.

### Task 2: Repository collaborator API and read-only project routes

**Files:**
- Modify: `backend/src/modules/projects/project.router.ts`
- Modify: `backend/src/modules/projects/project.service.ts`
- Create: `backend/test/repository-collaborators-route.test.ts`

**Interfaces:**
- Consumes: `listRepositoryCollaborators` from Task 1 and `ProjectService.get`.
- Produces: authenticated `GET /api/projects/:id/collaborators` and removes public mutation routes for manual projects.

- [ ] **Step 1: Write failing route contract tests**

```ts
it("exposes a collaborator endpoint and no manual project creation route", async () => {
  const source = await readFile(new URL("../src/modules/projects/project.router.ts", import.meta.url), "utf8");
  expect(source).toContain('projectRouter.get("/:id/collaborators"');
  expect(source).not.toContain('projectRouter.post("/"');
  expect(source).not.toContain('projectRouter.patch("/:id"');
  expect(source).not.toContain('projectRouter.put("/:id/members');
});
```

- [ ] **Step 2: Run the route test and verify RED**

Run: `npm test -- backend/test/repository-collaborators-route.test.ts`
Expected: FAIL because the endpoint is absent and mutation routes remain.

- [ ] **Step 3: Add the collaborator route before `/:id` and remove mutation routes**

```ts
projectRouter.get("/:id/collaborators", async (req, res, next) => {
  try {
    const project = await projects.get(String(req.params.id), user(req).email, admin(req));
    if (!project) return res.status(404).json({ error: "Repository not found" });
    if (!project.repositoryFullName || !project.installationId) return res.status(400).json({ error: "Repository is not linked to GitHub" });
    res.json(await listRepositoryCollaborators(project.repositoryFullName, project.installationId));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("GitHub collaborators HTTP")) return res.status(502).json({ error: "Không thể tải thành viên repository từ GitHub" });
    next(error);
  }
});
```

Remove the POST, PATCH, and member PUT routes from `project.router.ts`; retain GET list and GET detail. Keep service methods required by GitHub App synchronization and existing authorization until a separate migration can safely remove them.

- [ ] **Step 4: Run route and existing project-link tests**

Run: `npm test -- backend/test/repository-collaborators-route.test.ts backend/test/project-link.test.ts`
Expected: PASS.

### Task 3: Task datetime validation and collaborator enforcement

**Files:**
- Modify: `backend/src/modules/tasks/task.model.ts`
- Modify: `backend/src/core/validation.ts`
- Modify: `backend/src/modules/tasks/task.service.ts`
- Modify: `backend/src/modules/tasks/task.controller.ts`
- Modify: `backend/test/validation.test.ts`
- Create: `backend/test/task-assignee-policy.test.ts`

**Interfaces:**
- Produces: `TaskModel.startAt?: string`, `TaskModel.dueAt?: string`, validation for ISO timestamps, and repository-derived task metadata.

- [ ] **Step 1: Replace the legacy create validation test with datetime tests**

```ts
it("accepts UTC task scheduling and rejects reversed datetimes", () => {
  expect(taskInput({ title: "Review PR", projectId: "repo-1", repository: "acme/widgets", startAt: "2026-07-14T02:00:00.000Z", dueAt: "2026-07-14T04:00:00.000Z" }, "create")).toMatchObject({ startAt: "2026-07-14T02:00:00.000Z", dueAt: "2026-07-14T04:00:00.000Z" });
  expect(() => taskInput({ title: "Review PR", startAt: "2026-07-14T04:00:00.000Z", dueAt: "2026-07-14T02:00:00.000Z" }, "create")).toThrow("Deadline must be later than start time");
});

it("rejects legacy scheduling fields on create", () => {
  expect(() => taskInput({ title: "Review PR", sprint: "S1" }, "create")).toThrow("Unsupported task field");
});
```

- [ ] **Step 2: Run validation tests and verify RED**

Run: `npm test -- backend/test/validation.test.ts`
Expected: FAIL because `startAt`, `dueAt`, and `repository` create validation are not implemented.

- [ ] **Step 3: Implement model and validation changes**

Add `startAt?: string` and `dueAt?: string` to both task types. In `taskInput`, use create allowed fields `title`, `description`, `assignee`, `status`, `priority`, `startAt`, `dueAt`, `labels`, `project`, `projectId`, and `repository`; preserve legacy fields only for migration-safe update handling. Validate timestamps with `new Date(value).toISOString() === value` and enforce `Date.parse(dueAt) > Date.parse(startAt)` when both exist.

- [ ] **Step 4: Write a failing assignee policy test**

```ts
it("rejects an assignee outside the selected repository", async () => {
  await expect(assertRepositoryAssignee({ projectId: "repo-1", assignee: "outsider" }, dependencies)).rejects.toThrow("Assignee is not a repository collaborator");
});
```

- [ ] **Step 5: Implement repository resolution and assignee enforcement**

Extract an exported `assertRepositoryAssignee` helper in `task.controller.ts` that loads the selected project, requires GitHub linkage, overwrites client-supplied repository/project names with values from that record, and checks a non-empty assignee against `listRepositoryCollaborators`. Store `startAt` and `dueAt` in `TaskService.create`; leave legacy fields untouched on existing documents.

- [ ] **Step 6: Run backend task tests and verify GREEN**

Run: `npm test -- backend/test/validation.test.ts backend/test/task-assignee-policy.test.ts`
Expected: PASS.

### Task 4: Repository-driven create-task popup

**Files:**
- Modify: `frontend/src/features/tasks/CreateTask.tsx`
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/__tests__/create-task.test.ts`

**Interfaces:**
- Consumes: `GET /projects`, `GET /projects/:id/collaborators`, and task create fields from Task 3.
- Produces: repository selector, collaborator selector, UTC scheduling payload, and unassigned fallback.

- [ ] **Step 1: Write the failing frontend contract test**

```ts
it("creates repository-scoped tasks with collaborators and datetimes", async () => {
  const source = await readFile(new URL("../features/tasks/CreateTask.tsx", import.meta.url), "utf8");
  expect(source).toContain("/collaborators");
  expect(source).toContain('type="datetime-local"');
  expect(source).toContain("startAt");
  expect(source).toContain("dueAt");
  expect(source).toContain("toISOString()");
  expect(source).not.toContain("setSprint");
  expect(source).not.toContain("setTeam");
  expect(source).not.toContain("dueDate:");
});
```

- [ ] **Step 2: Run the frontend test and verify RED**

Run: `npm test -- frontend/src/__tests__/create-task.test.ts`
Expected: FAIL on missing collaborator endpoint and datetime fields.

- [ ] **Step 3: Implement the popup state and data flow**

Add `Collaborator = { login: string; name?: string; avatarUrl: string }`, `assignee`, `startAt`, `dueAt`, `collaborators`, `collaboratorsLoading`, and `collaboratorsError` state. Filter `/projects` results to records with `repositoryFullName`. On `projectId` change, clear the assignee and load `/projects/${projectId}/collaborators`.

Submit:

```ts
body: JSON.stringify({
  title,
  priority,
  projectId: project._id,
  repository: project.repositoryFullName,
  assignee,
  startAt: startAt ? new Date(startAt).toISOString() : undefined,
  dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
  labels: labels.split(",").map((item) => item.trim()).filter(Boolean),
})
```

Render repository, start-time, and deadline controls. Implement the collaborator control as an accessible button/listbox rather than a native select so every option can show `<img src={avatarUrl}>`, `name || login`, and `@login`; include `Chưa giao` as the empty option. Support keyboard focus, `aria-expanded`, and `role="option"`. Block submission only during collaborator loading or invalid datetime ordering; after a load error allow the empty assignee.

- [ ] **Step 4: Run the focused frontend test and verify GREEN**

Run: `npm test -- frontend/src/__tests__/create-task.test.ts`
Expected: PASS.

### Task 5: Read-only repositories and legacy-compatible task display/editing

**Files:**
- Modify: `frontend/src/features/auth/Projects.tsx`
- Modify: `frontend/src/features/tasks/EditTask.tsx`
- Modify: `frontend/src/components/TaskCard.tsx`
- Modify: `frontend/src/features/tasks/TaskDetail.tsx`
- Modify: `frontend/src/components/TaskMeta.tsx`
- Modify: `frontend/src/features/overview/Overview.tsx`
- Create: `frontend/src/__tests__/repository-task-ui.test.ts`

**Interfaces:**
- Consumes: task `startAt`/`dueAt` and GitHub-linked Project records.
- Produces: read-only repository page and datetime-aware task displays with `dueDate` fallback.

- [ ] **Step 1: Write failing source contract tests**

```ts
it("renders repositories as GitHub-managed and removes manual project mutations", async () => {
  const source = await readFile(new URL("../features/auth/Projects.tsx", import.meta.url), "utf8");
  expect(source).toContain("GitHub App");
  expect(source).not.toContain('method: "POST"');
  expect(source).not.toContain("members/");
  expect(source).not.toContain("Tạo dự án");
});

it("prefers dueAt and removes sprint and team from task interfaces", async () => {
  const files = await Promise.all(["../features/tasks/EditTask.tsx", "../components/TaskCard.tsx", "../features/tasks/TaskDetail.tsx"].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  expect(files.join("\n")).toContain("dueAt");
  expect(files.join("\n")).not.toMatch(/task\.sprint|task\.team|value\.sprint|value\.team/);
});
```

- [ ] **Step 2: Run the UI test and verify RED**

Run: `npm test -- frontend/src/__tests__/repository-task-ui.test.ts`
Expected: FAIL because manual project controls and legacy UI remain.

- [ ] **Step 3: Simplify Projects and update task views**

Replace `Projects` with a load-only repository grid showing `repositoryFullName`, description, and a `Đồng bộ bởi GitHub App` badge. Remove create and membership state/forms. Update edit/detail/card/meta/overview displays to format `dueAt` with `toLocaleString("vi-VN")`, fall back to legacy `dueDate`, display `startAt`, and remove Sprint/Team UI. Edit scheduling with `datetime-local` values derived from ISO strings and submit UTC `startAt`/`dueAt`.

- [ ] **Step 4: Run the UI tests and verify GREEN**

Run: `npm test -- frontend/src/__tests__/repository-task-ui.test.ts frontend/src/__tests__/create-task.test.ts`
Expected: PASS.

### Task 6: Full verification and delivery

**Files:**
- Modify only files required to resolve verification failures.

- [ ] **Step 1: Run type checking**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: exit 0 with zero warnings.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: all test files and tests pass.

- [ ] **Step 4: Run the production build**

Run: `npm run build`
Expected: frontend and backend builds exit 0.

- [ ] **Step 5: Review delivery scope**

Run: `git diff --check` and `git status --short`.
Expected: no whitespace errors; `.superpowers/` remains untracked and excluded from any future commit.
