import type { Task } from "../types";
export function TaskMeta({ task }: { task: Task }) {
  return (
    <p>
      <small>Priority: {task.priority}</small>
      {task.dueDate && <small> • Due: {task.dueDate}</small>}
      {task.labels.map((label) => (
        <small key={label}> • #{label}</small>
      ))}
    </p>
  );
}
