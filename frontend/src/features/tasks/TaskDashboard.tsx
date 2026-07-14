import type { Task } from "../../types";
import { ResponsiveGrid, Stack } from "../../components/layout/PageLayout";
export function TaskDashboard({ tasks }: { tasks: Task[] }) {
  const active = tasks.filter((t) => !["done", "cancelled"].includes(t.status));
  return (
    <Stack className="task-dashboard">
      <ResponsiveGrid minItemWidth="12rem" className="kpi-grid">
        <div className="dashboard-card" style={{ background: "linear-gradient(135deg, var(--bg-secondary), rgba(99, 102, 241, 0.05))", borderColor: "rgba(99, 102, 241, 0.2)" }}>
          <span className="label">Kết quả bộ lọc</span>
          <span className="value">{tasks.length}</span>
        </div>
        <div className="dashboard-card">
          <span className="label">Đang lọc hoạt động</span>
          <span className="value">{active.length}</span>
        </div>
        <div className="dashboard-card">
          <span className="label">Lọc cần chỉnh sửa</span>
          <span className="value" style={{ color: "var(--priority-urgent-text)" }}>
            {tasks.filter((t) => t.status === "needs_changes").length}
          </span>
        </div>
      </ResponsiveGrid>
      <div style={{ flex: 1 }} />
    </Stack>
  );
}
