import type { KeyboardEvent, MouseEvent } from "react";
import type { Task } from "../types";

const deadline = (task: Task) => task.dueAt || (task.dueDate ? `${task.dueDate}T23:59:59` : undefined);

type Props = {
  task: Task;
  onOpen: (opener: HTMLElement) => void;
  draggable?: boolean;
};

export function TaskCard({ task, onOpen, draggable = true }: Props) {
  const due = deadline(task);
  const overdue = Boolean(due && new Date(due).getTime() < Date.now() && !["done", "cancelled"].includes(task.status));
  const openFrom = (element: HTMLElement) => onOpen(element);
  const handleClick = (event: MouseEvent<HTMLElement>) => openFrom(event.currentTarget);
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openFrom(event.currentTarget);
  };

  return (
    <article
      className={`task-card task-card-compact priority-${task.priority}`}
      draggable={draggable}
      onDragStart={draggable ? (event) => event.dataTransfer.setData("taskId", task._id) : undefined}
      role="button"
      tabIndex={0}
      aria-label={`Xem chi tiết ${task.title}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="task-card-top">
        {task.code && <span className="badge-code" title={task.code}>{task.code}</span>}
        <span className={`badge-priority ${task.priority}`}>{task.priority}</span>
      </div>
      <h3 className="task-title" title={task.title}>{task.title}</h3>
      <div className="task-card-summary">
        <span className="task-assignee" title={task.assignee || "Chưa giao"}>@{task.assignee || "Chưa giao"}</span>
        {due && <span className={`due-badge ${overdue ? "overdue" : ""}`} title={new Date(due).toLocaleString("vi-VN")}>{overdue ? "Quá hạn · " : "Hạn · "}{new Date(due).toLocaleDateString("vi-VN")}</span>}
      </div>
    </article>
  );
}