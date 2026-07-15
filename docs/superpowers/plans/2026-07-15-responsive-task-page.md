# Responsive Task Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giữ Kanban desktop và cung cấp mobile task list nhóm theo trạng thái, bottom-sheet filter cùng task sheet gần toàn màn hình dưới 768px.

**Architecture:** `TaskBoard` tiếp tục sở hữu query/mutation và chọn view bằng một viewport hook. Các component mobile chỉ nhận dữ liệu/callbacks; overlay primitive quản lý dialog semantics, Escape, backdrop, scroll lock và focus restoration. CSS dùng breakpoint thống nhất 767px và không thay đổi API backend.

**Tech Stack:** React 19, TypeScript 5.9, TanStack Query 5, CSS, Vitest 3.

## Global Constraints

- Mobile task view áp dụng dưới 768px; desktop Kanban từ 768px.
- Không thay đổi API, schema, phân quyền hoặc optimistic mutation.
- Không drag/drop trên mobile và không cuộn ngang cấp trang.
- Mobile có sáu nhóm status đúng thứ tự hiện tại, kể cả empty state.
- Filter dùng draft; chỉ Apply/Clear thay đổi query.
- Overlay hỗ trợ backdrop, Escape, scroll lock, focus restoration và safe-area.
- Mọi control tương tác có vùng chạm tối thiểu 44x44px.

---

### Task 1: Viewport hook và mobile grouped list

**Files:**
- Create: `frontend/src/hooks/useResponsiveViewport.ts`
- Create: `frontend/src/features/tasks/MobileTaskList.tsx`
- Create: `frontend/src/__tests__/responsive-task-list.test.tsx`

**Interfaces:**
- Produces `useResponsiveViewport(): { isMobileTaskView: boolean }`.
- Produces `MobileTaskList({ tasks, collapsed, onToggle, onOpen, onDelete, onStatus })`.

- [ ] Write a failing test using a controllable `window.matchMedia` stub. Assert query `(max-width: 767px)`, six headings in order, counts, empty state, `aria-expanded`, toggle callback, and absence of draggable/drop handlers.
- [ ] Run `npx vitest run frontend/src/__tests__/responsive-task-list.test.tsx`; expect missing-module failure.
- [ ] Implement the hook with `addEventListener("change")` plus `addListener` fallback and cleanup. Implement the list using exported status/label constants, semantic sections and `TaskCard` callbacks.
- [ ] Re-run the focused test; expect PASS.
- [ ] Commit `feat: add responsive task list foundation`.

Test shape:

```tsx
expect(screen.getAllByRole("heading", { level: 2 }).map(node => node.textContent)).toEqual([
  expect.stringContaining("Cần làm"),
  expect.stringContaining("Đang review"),
  expect.stringContaining("Cần sửa đổi"),
  expect.stringContaining("Sẵn sàng"),
  expect.stringContaining("Hoàn thành"),
  expect.stringContaining("Đã hủy"),
]);
expect(container.querySelector("[draggable=true]")).toBeNull();
```

### Task 2: Responsive overlay và mobile filter sheet

**Files:**
- Create: `frontend/src/components/ResponsiveTaskOverlay.tsx`
- Modify: `frontend/src/features/tasks/TaskFilters.tsx`
- Create: `frontend/src/__tests__/responsive-task-filter.test.tsx`

**Interfaces:**
- Produces `ResponsiveTaskOverlay({ open, label, openerRef, onClose, children, footer })`.
- `TaskFilters` consumes `value`, `onChange`, `mobile`, and exposes bottom-sheet behavior while retaining desktop immediate filtering.

- [ ] Write failing tests for filter badge, draft cancel, Apply, Clear, Escape, backdrop, inside click, scroll lock and focus restoration.
- [ ] Run the focused filter test; expect missing overlay/new-prop failures.
- [ ] Implement overlay with `role="dialog"`, `aria-modal`, document key listener, saved `body.style.overflow`, and restoration to opener ref.
- [ ] Refactor `TaskFilters`: desktop retains immediate `update`; mobile button opens overlay and edits draft, Apply calls `onChange(draft)`, Clear applies empty query, Cancel resets draft from applied `value`.
- [ ] Run the focused test; expect PASS.
- [ ] Commit `feat: add mobile task filter sheet`.

### Task 3: Integrate responsive views and task overlays

**Files:**
- Modify: `frontend/src/features/tasks/TaskBoard.tsx`
- Modify: `frontend/src/features/tasks/TaskDetail.tsx`
- Modify: `frontend/src/features/tasks/CreateTask.tsx` only if footer callbacks require markup hooks.
- Create: `frontend/src/__tests__/responsive-task-board.test.tsx`

**Interfaces:**
- `TaskBoard` renders exactly one of desktop `.kanban-grid` or `MobileTaskList` from the same `tasks` array.
- Collapsed state is `Set<string>` owned by `TaskBoard` and survives detail open/close.
- Create/detail use `ResponsiveTaskOverlay`; TaskDetail renders content without nested top-level dialog when wrapped.

- [ ] Write failing integration tests with mocked API/query provider: mobile list exists and Kanban absent; desktop inverse; collapse survives open/close; mobile create/detail have dialog semantics.
- [ ] Run focused board test; expect failures against current unconditional Kanban/dialog rendering.
- [ ] Extract shared statuses/labels, add viewport selection and collapsed state, pass controlled query to filters, and wrap create/detail in the responsive overlay.
- [ ] Preserve all existing mutation implementations byte-for-byte except callback plumbing.
- [ ] Run responsive board test and existing frontend tests; expect PASS.
- [ ] Commit `feat: integrate responsive task page views`.

### Task 4: Responsive styles and quality gates

**Files:**
- Modify: `frontend/src/styles/app.css`
- Modify: `frontend/src/__tests__/responsive-task-board.test.tsx`

**Interfaces:**
- CSS classes: `.mobile-task-list`, `.mobile-status-group`, `.mobile-task-toolbar`, `.task-sheet-backdrop`, `.task-sheet`, `.task-sheet__header`, `.task-sheet__content`, `.task-sheet__footer`, `.filter-trigger`, `.filter-count`.

- [ ] Add a failing structural test asserting every responsive class is referenced by rendered markup and CSS contains `@media (max-width: 767px)`, safe-area usage and reduced-motion handling.
- [ ] Run focused test; expect missing CSS selectors.
- [ ] Add mobile-first styles: no page overflow, 44px controls, grouped cards, sticky sheet regions, `100dvh`, `env(safe-area-inset-bottom)`, two-to-one-column dashboards and stacked pagination. At 768px restore desktop dialog/Kanban behavior.
- [ ] Manually inspect CSS to remove competing mobile Kanban horizontal rules for this feature rather than adding another contradictory breakpoint.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`; all must exit 0.
- [ ] Run `git diff --check`; expect no errors.
- [ ] Commit `feat: complete responsive task page`.

## Spec Coverage

- Mobile grouped list, fixed status order, collapse and no drag: Tasks 1 and 3.
- Draft filter bottom sheet, badge and focus behavior: Task 2.
- Create/detail/edit sheet behavior: Tasks 2 and 3.
- No horizontal page scroll, safe-area and touch targets: Task 4.
- Shared query/mutations and unchanged desktop Kanban: Task 3.
- Accessibility and quality gates: Tasks 1–4.

