import type { Task } from "../types";

export function TaskMeta({ task }: { task: Task }) {
  const due = task.dueAt || (task.dueDate ? `${task.dueDate}T23:59:59` : undefined);
  return <p>
    <small>Priority: {task.priority}</small>
    {task.startAt && <small> • Bắt đầu: {new Date(task.startAt).toLocaleString("vi-VN")}</small>}
    {due && <small> • Hạn: {new Date(due).toLocaleString("vi-VN")}</small>}
    {task.labels.map((label) => <small key={label}> • #{label}</small>)}
  </p>;
}
