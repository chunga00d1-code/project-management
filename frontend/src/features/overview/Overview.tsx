import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useRealtimeRefresh } from "../../realtime/useRealtimeRefresh";
import { ServerDashboard } from "../tasks/ServerDashboard";
import type { Task } from "../../types";
import type { Project } from "../auth/Projects";

const statusLabels: Record<string, string> = {
  todo: "📋 Cần làm",
  in_review: "🔍 Đang review",
  needs_changes: "⚠️ Cần sửa đổi",
  ready: "✅ Sẵn sàng",
  done: "🎉 Hoàn thành",
  cancelled: "🚫 Đã hủy",
};
const taskDeadline = (task: Task) => task.dueAt || (task.dueDate ? `${task.dueDate}T23:59:59` : undefined);

export function Overview({ onNavigate }: { onNavigate: (page: "tasks" | "projects") => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");

  const load = () =>
    Promise.all([api<Task[]>("/tasks"), api<Project[]>("/projects")])
      .then(([t, p]) => {
        setTasks(t);
        setProjects(p);
      })
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    void load();
  }, []);
  useRealtimeRefresh(["task.", "project."], () => void load());

  const mismatched = tasks.filter((t) => t.prSyncStatus === "mismatched");
  const recent = [...tasks].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 6);
  const byStatus = Object.keys(statusLabels).map((status) => ({ status, count: tasks.filter((t) => t.status === status).length }));
  const byProject = Object.entries(
    tasks.reduce<Record<string, number>>((all, task) => {
      const key = task.project || "Chưa gán dự án";
      all[key] = (all[key] || 0) + 1;
      return all;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const overdue = tasks
    .filter((task) => { const due = taskDeadline(task); return Boolean(due && new Date(due).getTime() < Date.now() && !["done", "cancelled"].includes(task.status)); })
    .sort((a, b) => (taskDeadline(a) || "").localeCompare(taskDeadline(b) || ""));
  const activeTasks = tasks.filter((t) => !["done", "cancelled"].includes(t.status));
  const byAssignee = Object.entries(
    activeTasks.reduce<Record<string, number>>((all, task) => {
      const key = task.assignee || "Chưa giao";
      all[key] = (all[key] || 0) + 1;
      return all;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const byRepository = Object.entries(
    tasks.reduce<Record<string, number>>((all, task) => {
      const key = task.repository || "Chưa liên kết repo";
      all[key] = (all[key] || 0) + 1;
      return all;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Tổng quan</h1>
          <p className="page-subtitle">Bức tranh toàn cảnh về dự án, nhiệm vụ và các cảnh báo cần chú ý.</p>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      <ServerDashboard />

      <div className="grid-2" style={{ marginTop: "1.5rem" }}>
        <section>
          <h3>📊 Phân bố theo trạng thái</h3>
          <div className="dashboard-grid compact" style={{ marginTop: "1rem" }}>
            {byStatus.map((item) => (
              <div className="dashboard-card" key={item.status}>
                <span className="label">{statusLabels[item.status]}</span>
                <span className="value">{item.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3>👤 Khối lượng theo người làm</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
            {byAssignee.slice(0, 8).map(([assignee, count]) => (
              <div key={assignee} className="project-card" style={{ margin: 0, justifyContent: "space-between" }}>
                <span>{assignee}</span>
                <strong>{count} nhiệm vụ đang xử lý</strong>
              </div>
            ))}
            {byAssignee.length === 0 && <p style={{ color: "var(--text-muted)" }}>Chưa có nhiệm vụ nào đang hoạt động.</p>}
          </div>
        </section>
      </div>

      <div className="grid-2" style={{ marginTop: "1.5rem" }}>
        <section>
          <h3>🔗 Theo repository GitHub</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
            {byRepository.map(([repository, count]) => (
              <div key={repository} className="project-card" style={{ margin: 0, justifyContent: "space-between" }}>
                <span>{repository}</span>
                <strong>{count} nhiệm vụ</strong>
              </div>
            ))}
            {byRepository.length === 0 && <p style={{ color: "var(--text-muted)" }}>Chưa có nhiệm vụ nào liên kết repository.</p>}
          </div>
        </section>

        <section>
          <h3>⏰ Task quá hạn ({overdue.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
            {overdue.map((task) => (
              <div key={task._id} className="project-card" style={{ margin: 0, borderLeft: "4px solid var(--priority-urgent-text, #f87171)", flexDirection: "column", alignItems: "stretch", gap: "0.25rem", cursor: "pointer" }} onClick={() => onNavigate("tasks")}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{task.code ? `${task.code} · ` : ""}{task.title}</strong>
                  <span style={{ color: "var(--priority-urgent-text, #f87171)" }}>Hạn: {task.dueAt ? new Date(task.dueAt).toLocaleString("vi-VN") : task.dueDate}</span>
                </div>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                  {task.assignee || "Chưa giao"} · {task.project || "Chưa gán dự án"}
                </span>
              </div>
            ))}
            {overdue.length === 0 && <p style={{ color: "var(--text-muted)" }}>Không có task quá hạn. 🎉</p>}
          </div>
        </section>
      </div>

      <section style={{ marginTop: "1.5rem" }}>
        <h3>📂 Dự án ({projects.length})</h3>
        <div className="dashboard-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: "1rem" }}>
          {projects.map((project) => (
            <div key={project._id} className="project-card" style={{ margin: 0, flexDirection: "column", alignItems: "stretch", gap: "0.35rem", cursor: "pointer" }} onClick={() => onNavigate("projects")}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{project.name}</strong>
                <span className="pill">{byProject.find(([name]) => name === project.name)?.[1] || 0} task</span>
              </div>
              {project.description && <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: 0 }}>{project.description}</p>}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                <span>{project.members.length} thành viên</span>
                {project.repositoryFullName && <span>Repo: {project.repositoryFullName}</span>}
              </div>
            </div>
          ))}
          {projects.length === 0 && <p style={{ color: "var(--text-muted)" }}>Chưa có dự án nào.</p>}
        </div>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h3>⚠️ Pull Request không khớp Task ({mismatched.length})</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
          {mismatched.map((task) => (
            <div key={task._id} className="project-card" style={{ margin: 0, borderLeft: "4px solid var(--priority-urgent-text, #f87171)", flexDirection: "column", alignItems: "stretch", gap: "0.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{task.code || task._id}</strong>
                <span>{task.title}</span>
              </div>
              <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                Lý do: {(task.prMismatchReasons || []).join(", ")}
              </span>
            </div>
          ))}
          {mismatched.length === 0 && <p style={{ color: "var(--text-muted)" }}>Không có PR nào lệch task hiện tại. 🎉</p>}
        </div>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h3>🕓 Nhiệm vụ cập nhật gần đây</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
          {recent.map((task) => (
            <div key={task._id} className="project-card" style={{ margin: 0, justifyContent: "space-between", cursor: "pointer" }} onClick={() => onNavigate("tasks")}>
              <span>{task.code ? `${task.code} · ` : ""}{task.title}</span>
              <span className="pill">{statusLabels[task.status] || task.status}</span>
            </div>
          ))}
          {recent.length === 0 && <p style={{ color: "var(--text-muted)" }}>Chưa có nhiệm vụ nào.</p>}
        </div>
      </section>
    </main>
  );
}
