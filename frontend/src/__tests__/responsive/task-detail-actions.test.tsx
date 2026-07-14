import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskDetail } from "../../features/tasks/TaskDetail";
import { renderAtViewport } from "../../test/renderAtViewport";
import type { Task } from "../../types";
afterEach(cleanup);
const task: Task = { _id:"1", title:"Task", description:"", assignee:"", status:"todo", priority:"medium", labels:[], comments:[], startAt:"2026-07-15T10:00:00.000Z", dueAt:"2026-07-15T11:00:00.000Z" };
describe("TaskDetail footer actions",()=>{
 it("disables footer Save for an invalid schedule and enables it when valid",async()=>{
  const user=userEvent.setup(); renderAtViewport(<TaskDetail task={task} onClose={vi.fn()} onChange={vi.fn()}/>,375);
  await user.click(screen.getByRole("button",{name:/Sửa/})); const save=screen.getByRole("button",{name:/Lưu thay đổi/});
  const dates=document.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
  fireEvent.change(dates[1], { target: { value: "2026-07-15T09:00" } }); expect(save).toBeDisabled();
  fireEvent.change(dates[1], { target: { value: "2026-07-15T18:00" } }); expect(screen.getByRole("button",{name:/Lưu thay đổi/})).toBeEnabled();
 });
});