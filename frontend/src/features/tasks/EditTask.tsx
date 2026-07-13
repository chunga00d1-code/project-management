import { useState } from "react";
import type { Task } from "../../types";
import { api } from "../../api/client";
export function EditTask({ task, onDone, onCancel }: { task: Task; onDone: () => void; onCancel: () => void }) {
  const [value, setValue] = useState(task);
  return (
    <form
      style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}
      onSubmit={async (e) => {
        e.preventDefault();
        await api(`/tasks/${task._id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: value.title,
            assignee: value.assignee,
            priority: value.priority,
            dueDate: value.dueDate,
            labels: value.labels,
            project: value.project,
            sprint: value.sprint,
            team: value.team,
          }),
        });
        onDone();
      }}
    >
      <div className="grid-2">
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Tiêu đề nhiệm vụ</label>
          <input value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Người thực hiện</label>
          <input value={value.assignee || ""} onChange={(e) => setValue({ ...value, assignee: e.target.value })} placeholder="Email người thực hiện" />
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Dự án</label>
          <input value={value.project || ""} onChange={(e) => setValue({ ...value, project: e.target.value })} placeholder="Tên dự án" />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Sprint</label>
          <input value={value.sprint || ""} onChange={(e) => setValue({ ...value, sprint: e.target.value })} placeholder="Tên Sprint" />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Team</label>
          <input value={value.team || ""} onChange={(e) => setValue({ ...value, team: e.target.value })} placeholder="Tên Team" />
        </div>
      </div>

      <div className="grid-2">
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Độ ưu tiên</label>
          <select value={value.priority} onChange={(e) => setValue({ ...value, priority: e.target.value })}>
            {["low", "medium", "high", "urgent"].map((x) => (
              <option key={x} value={x}>{x.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Hạn chót</label>
          <input type="date" value={value.dueDate || ""} onChange={(e) => setValue({ ...value, dueDate: e.target.value })} />
        </div>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Nhãn (cách nhau bằng dấu phẩy)</label>
        <input value={value.labels.join(",")} onChange={(e) => setValue({ ...value, labels: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="bug, UI, docs" />
      </div>

      <div className="flex-row" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
        <button type="button" className="btn-danger" style={{ width: "auto", padding: "0.6rem 1.2rem", borderRadius: "var(--radius-md)" }} onClick={onCancel}>
          Hủy bỏ
        </button>
        <button className="btn-primary" style={{ width: "auto", padding: "0.6rem 1.2rem" }}>
          Lưu thay đổi
        </button>
      </div>
    </form>
  );
}
