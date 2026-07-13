import type { Task } from "../types";
export function TaskCard({
  task,
  onStatus,
  onOpen,
  onDelete,
}: {
  task: Task;
  onStatus: (status: string) => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className="task-card"
      draggable
      onDragStart={(e) => e.dataTransfer.setData("taskId", task._id)}
    >
      <div className="task-title">{task.title}</div>
      <div className="task-meta">
        <span>👤 {task.assignee || "Chưa giao"}</span>
        <span className={`badge-priority ${task.priority}`}>
          {task.priority.toUpperCase()}
        </span>
        {task.project && <span>📁 {task.project}</span>}
      </div>
      <select value={task.status} onChange={(e) => onStatus(e.target.value)}>
        {[
          "todo",
          "in_review",
          "needs_changes",
          "ready",
          "done",
          "cancelled",
        ].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <div className="card-actions">
        <button className="btn-details" onClick={onOpen}>
          Chi tiết
        </button>
        <button className="btn-danger" style={{ padding: "0.4rem" }} onClick={onDelete}>
          Xóa
        </button>
      </div>
    </article>
  );
}
