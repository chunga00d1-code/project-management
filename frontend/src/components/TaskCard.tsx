import type { Task } from "../types";

const deadline = (task: Task) => task.dueAt || (task.dueDate ? `${task.dueDate}T23:59:59` : undefined);

export function TaskCard({ task, onStatus, onOpen, onDelete }: { task: Task; onStatus: (status: string) => void; onOpen: () => void; onDelete: () => void }) {
  const checklist = task.checklist || [];
  const completed = checklist.filter((item) => item.done).length;
  const due = deadline(task);
  const overdue = Boolean(due && new Date(due).getTime() < Date.now() && !["done", "cancelled"].includes(task.status));
  return <article className={`task-card priority-${task.priority}`} draggable onDragStart={(event) => event.dataTransfer.setData("taskId", task._id)}>
    <div className="task-card-top">{task.code && <span className="badge-code">{task.code}</span>}<span className={`badge-priority ${task.priority}`}>{task.priority}</span>{due && <span className={`due-badge ${overdue ? "overdue" : ""}`}>{overdue ? "Quá hạn · " : "Hạn · "}{new Date(due).toLocaleString("vi-VN")}</span>}</div>
    {task.prSyncStatus === "mismatched" && <div className="mismatch-badge" title={(task.prMismatchReasons || []).join(", ")}>⚠️ PR không khớp: {(task.prMismatchReasons || []).join(", ")}</div>}
    <button className="task-title" onClick={onOpen}>{task.title}</button>
    <div className="task-meta"><span>@{task.assignee || "Chưa giao"}</span>{task.repository && <span>{task.repository}</span>}{task.startAt && <span>Bắt đầu {new Date(task.startAt).toLocaleString("vi-VN")}</span>}</div>
    {task.labels.length > 0 && <div className="label-row">{task.labels.slice(0, 3).map((label) => <span key={label}>#{label}</span>)}</div>}
    {checklist.length > 0 && <div className="checklist-progress"><div><span>Checklist</span><strong>{completed}/{checklist.length}</strong></div><progress max={checklist.length} value={completed} /></div>}
    <label className="status-control"><span>Trạng thái</span><select value={task.status} onChange={(event) => onStatus(event.target.value)}>{["todo", "in_review", "needs_changes", "ready", "done", "cancelled"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
    <div className="card-actions"><button className="btn-details" onClick={onOpen}>Xem chi tiết</button><button className="btn-icon-danger" aria-label={`Xóa ${task.title}`} onClick={onDelete}>×</button></div>
  </article>;
}
