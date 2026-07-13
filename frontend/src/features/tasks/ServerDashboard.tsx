import { useEffect, useState } from "react";
import { api } from "../../api/client";
type Dashboard = { total: number; active: number; needsChanges: number; overdue: number; blocked: number; byRepository: { repository: string; count: number }[]; byProject: { project: string; count: number }[]; byAssignee: { assignee: string; count: number }[]; };
export function ServerDashboard() {
  const [value, setValue] = useState<Dashboard>();
  useEffect(() => {
    void api<Dashboard>("/tasks/dashboard").then(setValue);
  }, []);
  
  if (!value) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
      <div className="dashboard-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
        <div className="dashboard-card">
          <span className="label">Tổng số nhiệm vụ</span>
          <span className="value">{value.total}</span>
        </div>
        <div className="dashboard-card">
          <span className="label">Đang thực hiện</span>
          <span className="value">{value.active}</span>
        </div>
        <div className="dashboard-card">
          <span className="label">Cần chỉnh sửa</span>
          <span className="value" style={{ color: "var(--priority-urgent-text)" }}>{value.needsChanges}</span>
        </div>
        <div className="dashboard-card">
          <span className="label">Quá hạn chót</span>
          <span className="value" style={{ color: "var(--priority-urgent-text)" }}>{value.overdue}</span>
        </div>
        <div className="dashboard-card">
          <span className="label">Bị chặn</span>
          <span className="value" style={{ color: "var(--priority-high-text)" }}>{value.blocked}</span>
        </div>
      </div>
      <div className="project-card" style={{ padding: "1.25rem", margin: 0, fontSize: "0.9rem" }}>
        <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)" }}>📊 Phân bố tải lượng</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Theo kho mã nguồn (Repo)</div>
            <ul style={{ listStyle: "none", paddingLeft: 0 }}>
              {value.byRepository.map((item) => (
                <li key={item.repository} style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border-color)" }}>
                  📦 {item.repository}: <strong>{item.count}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Theo người thực hiện</div>
            <ul style={{ listStyle: "none", paddingLeft: 0 }}>
              {value.byAssignee.map((item) => (
                <li key={item.assignee} style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border-color)" }}>
                  👤 {item.assignee}: <strong>{item.count}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

