import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Project } from "../auth/Projects";
export function CreateTask({ onCreated }: { onCreated: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [labels, setLabels] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [sprint, setSprint] = useState("");
  const [team, setTeam] = useState("");

  useEffect(() => {
    void api<Project[]>("/projects").then((items) => {
      setProjects(items);
      if (items.length) setProjectId((current) => current || items[0]._id);
    });
  }, []);

  const project = projects.find((item) => item._id === projectId);

  if (!isOpen) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <button className="btn-primary" style={{ width: "auto" }} onClick={() => setIsOpen(true)}>
          ➕ Tạo nhiệm vụ mới
        </button>
      </div>
    );
  }

  return (
    <form
      className="project-card"
      style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "100%", animation: "modalEntrance 0.3s ease" }}
      onSubmit={async (e) => {
        e.preventDefault();
        await api("/tasks", {
          method: "POST",
          body: JSON.stringify({
            title,
            priority,
            dueDate: dueDate || undefined,
            projectId: project?._id,
            project: project?.name || "",
            sprint,
            team: team || project?.team || "",
            labels: labels.split(",").map((x) => x.trim()).filter(Boolean),
          }),
        });
        setTitle("");
        setDueDate("");
        setLabels("");
        setSprint("");
        setTeam("");
        setIsOpen(false);
        onCreated();
      }}
    >
      <h3>Tạo Nhiệm Vụ Mới</h3>
      <div className="grid-2">
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Tiêu đề nhiệm vụ *</label>
          <input required placeholder="Nhập tiêu đề nhiệm vụ..." value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Dự án *</label>
          <select required value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Chọn dự án...</option>
            {projects.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Độ ưu tiên</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {["low", "medium", "high", "urgent"].map((x) => (
              <option key={x} value={x}>
                {x.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Hạn chót</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Sprint</label>
          <input placeholder="VD: Sprint 1" value={sprint} onChange={(e) => setSprint(e.target.value)} />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Team ghi đè</label>
          <input placeholder="VD: Backend" value={team} onChange={(e) => setTeam(e.target.value)} />
        </div>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Nhãn (ngăn cách bằng dấu phẩy)</label>
        <input placeholder="VD: bug, core, frontend" value={labels} onChange={(e) => setLabels(e.target.value)} />
      </div>

      <div className="flex-row" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
        <button type="button" className="btn-danger" style={{ padding: "0.75rem 1.5rem", borderRadius: "var(--radius-md)" }} onClick={() => setIsOpen(false)}>
          Hủy bỏ
        </button>
        <button className="btn-primary" style={{ width: "auto", padding: "0.75rem 1.5rem" }} disabled={!projectId}>
          Tạo nhiệm vụ
        </button>
      </div>
    </form>
  );
}
