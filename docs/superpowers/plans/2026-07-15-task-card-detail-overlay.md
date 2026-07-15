# Compact Task Card and Detail Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace overloaded task cards with compact, fully clickable summaries and render task details in the responsive overlay above sticky page controls.

**Architecture:** Keep `TaskCard` responsible only for the five approved summary fields and activation behavior. Reuse `ResponsiveTaskOverlay` as the single modal shell for `TaskDetail`, while `TaskBoard` retains the selected card element so focus can be restored when the overlay closes.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, React server rendering tests.

## Global Constraints

- Keep the existing API and task data model unchanged.
- Show only task code, title, priority, deadline, and assignee on cards.
- Preserve desktop drag-and-drop and disable dragging on mobile.
- Make the entire card keyboard accessible with Enter and Space.
- Keep detailed actions inside the detail overlay.
- The detail overlay must be above sticky filters and toast messages.

---

### Task 1: Compact clickable task card

**Files:**
- Modify: `frontend/src/components/TaskCard.tsx`
- Modify: `frontend/src/features/tasks/TaskBoard.tsx`
- Modify: `frontend/src/features/tasks/MobileTaskList.tsx`
- Modify: `frontend/src/styles/app.css`
- Test: `frontend/src/__tests__/responsive-task-list.test.tsx`

**Interfaces:**
- Consumes: `Task`, `onOpen(): void`, and optional `draggable: boolean`.
- Produces: `TaskCard` with no status/delete callbacks and an optional `openerRef?: RefObject<HTMLElement | null>`.

- [ ] **Step 1: Write failing card structure tests**

Add assertions that the rendered card has `role="button"`, `tabindex="0"`, the five approved information groups, and excludes status controls, checklist progress, labels, repository, PR mismatch, and delete/details buttons.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run frontend/src/__tests__/responsive-task-list.test.tsx`

Expected: FAIL because the current card still renders status, checklist, labels, and actions.

- [ ] **Step 3: Implement the minimal compact card**

Remove the unused `onStatus` and `onDelete` props. Render a focusable article with click and keyboard handlers, preserve `draggable` and `onDragStart`, clamp the title to two lines, and render assignee/deadline metadata with safe ellipsis.

- [ ] **Step 4: Update card callers**

Remove status/delete callback wiring from `TaskBoard` and `MobileTaskList`. Pass the selected card element to `TaskBoard` when opening details so it can become the focus restoration target.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run frontend/src/__tests__/responsive-task-list.test.tsx`

Expected: all responsive task list tests pass.

- [ ] **Step 6: Commit**

Run: `git add frontend/src/components/TaskCard.tsx frontend/src/features/tasks/TaskBoard.tsx frontend/src/features/tasks/MobileTaskList.tsx frontend/src/styles/app.css frontend/src/__tests__/responsive-task-list.test.tsx && git commit -m "fix: simplify task cards"`

### Task 2: Responsive task detail overlay

**Files:**
- Modify: `frontend/src/features/tasks/TaskDetail.tsx`
- Modify: `frontend/src/features/tasks/TaskBoard.tsx`
- Modify: `frontend/src/components/ResponsiveTaskOverlay.tsx`
- Modify: `frontend/src/styles/app.css`
- Test: `frontend/src/__tests__/responsive-task-list.test.tsx`

**Interfaces:**
- Consumes: `ResponsiveTaskOverlay` props `open`, `label`, `onClose`, `openerRef`, and `children`.
- Produces: `TaskDetail` prop `openerRef?: RefObject<HTMLElement | null>` and a `.task-detail-sheet` modifier.

- [ ] **Step 1: Write failing overlay tests**

Render `TaskDetail` to static markup and assert it uses `role="dialog"`, `aria-modal="true"`, `.task-detail-sheet`, and no native `<dialog>` element. Add an overlay Escape test using a DOM-capable test file if necessary.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run frontend/src/__tests__/responsive-task-list.test.tsx`

Expected: FAIL because `TaskDetail` currently renders a native `<dialog>`.

- [ ] **Step 3: Move TaskDetail into ResponsiveTaskOverlay**

Wrap existing detail/edit content with `ResponsiveTaskOverlay`, pass `openerRef`, remove the legacy dialog and bottom close button, and retain all existing task actions inside the overlay content.

- [ ] **Step 4: Fix overlay sizing and stacking**

Set `.task-sheet-backdrop` above the toast layer, give `.task-detail-sheet` a desktop width up to `900px`, constrain it to the viewport, add safe wrapping to detail content, and keep the existing near-full-screen mobile sheet behavior.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run frontend/src/__tests__/responsive-task-list.test.tsx`

Expected: all focused tests pass.

- [ ] **Step 6: Run full verification**

Run: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

Expected: every command exits 0 with no failures.

- [ ] **Step 7: Commit**

Run: `git add frontend/src/features/tasks/TaskDetail.tsx frontend/src/features/tasks/TaskBoard.tsx frontend/src/components/ResponsiveTaskOverlay.tsx frontend/src/styles/app.css frontend/src/__tests__/responsive-task-list.test.tsx && git commit -m "fix: show task details in responsive overlay"`
