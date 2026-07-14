import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Task } from "../../types";

type Collaborator = { login: string };
const localDateTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export function EditTask({ task, onDone, onCancel }: { task: Task; onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [assignee, setAssignee] = useState(task.assignee || "");
  const [priority, setPriority] = useState(task.priority);
  const [labels, setLabels] = useState(task.labels.join(","));
  const [startAt, setStartAt] = useState(localDateTime(task.startAt));
  const [dueAt, setDueAt] = useState(localDateTime(task.dueAt || (task.dueDate ? `${task.dueDate}T00:00:00.000Z` : undefined)));
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  useEffect(() => {
    if (task.projectId) void api<Collaborator[]>(`/projects/${task.projectId}/collaborators`).then(setCollaborators).catch(() => setCollaborators([]));
  }, [task.projectId]);

  const invalidSchedule = Boolean(startAt && dueAt && new Date(dueAt).getTime() <= new Date(startAt).getTime());
  return (
    <form style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }} onSubmit={async (event) => {
      event.preventDefault();
      if (invalidSchedule) return;
      await api(`/tasks/${task._id}`, { method: "PATCH", body: JSON.stringify({
        title,
        assignee,
        priority,
        labels: labels.split(",").map((item) => item.trim()).filter(Boolean),
        startAt: startAt ? new Date(startAt).toISOString() : undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      }) });
      onDone();
    }}>
      <div className="form-grid">
        <div><label>Tiêu đề nhiệm vụ</label><input required value={title} onChange={(event) => setTitle(event.target.value)} /></div>
        <div><label>Người thực hiện</label><select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Chưa giao</option>{collaborators.map((item) => <option key={item.login} value={item.login}>@{item.login}</option>)}</select></div>
      </div>
      <div className="form-grid">
        <div><label>Độ ưu tiên</label><select value={priority} onChange={(event) => setPriority(event.target.value)}>{["low", "medium", "high", "urgent"].map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></div>
        <div><label>Thời gian bắt đầu</label><input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} /></div>
        <div><label>Hạn chót</label><input type="datetime-local" min={startAt || undefined} value={dueAt} onChange={(event) => setDueAt(event.target.value)} />{invalidSchedule && <small className="field-error">Hạn chót phải sau thời gian bắt đầu.</small>}</div>
      </div>
      <div><label>Nhãn (cách nhau bằng dấu phẩy)</label><input value={labels} onChange={(event) => setLabels(event.target.value)} /></div>
      <div className="flex-row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn-danger" onClick={onCancel}>Hủy bỏ</button><button className="btn-primary" style={{ width: "auto" }} disabled={invalidSchedule}>Lưu thay đổi</button></div>
    </form>
  );
}
