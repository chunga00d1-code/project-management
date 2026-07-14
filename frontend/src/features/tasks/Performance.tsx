import { useEffect, useState } from "react";
import { api } from "../../api/client";

type AssigneePerformance = {
  assignee: string;
  totalTasks: number;
  completed: number;
  completedOnTime: number;
  completedLate: number;
  active: number;
  overdueActive: number;
  mismatchCount: number;
};

export function Performance() {
  const [rows, setRows] = useState<AssigneePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<AssigneePerformance[]>("/tasks/performance")
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Không thể tải dữ liệu hiệu suất"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main>
      <header>
        <h2>Hiệu Suất Theo Thành Viên</h2>
        <p className="page-subtitle">Tổng hợp tiến độ hoàn thành, quá hạn và các lần lệch task/PR theo từng người thực hiện.</p>
      </header>

      {error && <div className="error-message" style={{ margin: "1rem 0" }}>{error}</div>}
      {loading && <div className="toast-message">Đang tải dữ liệu…</div>}

      {!loading && !error && (
        rows.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>Chưa có dữ liệu.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="project-card" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.6rem", borderBottom: "1px solid var(--border-color)" }}>Người thực hiện</th>
                  <th style={{ textAlign: "right", padding: "0.6rem", borderBottom: "1px solid var(--border-color)" }}>Tổng task</th>
                  <th style={{ textAlign: "right", padding: "0.6rem", borderBottom: "1px solid var(--border-color)" }}>Hoàn thành</th>
                  <th style={{ textAlign: "right", padding: "0.6rem", borderBottom: "1px solid var(--border-color)" }}>Đúng hạn</th>
                  <th style={{ textAlign: "right", padding: "0.6rem", borderBottom: "1px solid var(--border-color)" }}>Trễ hạn</th>
                  <th style={{ textAlign: "right", padding: "0.6rem", borderBottom: "1px solid var(--border-color)" }}>Đang xử lý</th>
                  <th style={{ textAlign: "right", padding: "0.6rem", borderBottom: "1px solid var(--border-color)" }}>Quá hạn (đang mở)</th>
                  <th style={{ textAlign: "right", padding: "0.6rem", borderBottom: "1px solid var(--border-color)" }}>Lệch task/PR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.assignee}>
                    <td style={{ padding: "0.6rem", borderBottom: "1px solid var(--border-color)" }}>{row.assignee}</td>
                    <td style={{ textAlign: "right", padding: "0.6rem", borderBottom: "1px solid var(--border-color)" }}>{row.totalTasks}</td>
                    <td style={{ textAlign: "right", padding: "0.6rem", borderBottom: "1px solid var(--border-color)" }}>{row.completed}</td>
                    <td style={{ textAlign: "right", padding: "0.6rem", borderBottom: "1px solid var(--border-color)", color: "var(--success-color, #4ade80)" }}>{row.completedOnTime}</td>
                    <td style={{ textAlign: "right", padding: "0.6rem", borderBottom: "1px solid var(--border-color)", color: row.completedLate ? "var(--priority-urgent-text)" : undefined }}>{row.completedLate}</td>
                    <td style={{ textAlign: "right", padding: "0.6rem", borderBottom: "1px solid var(--border-color)" }}>{row.active}</td>
                    <td style={{ textAlign: "right", padding: "0.6rem", borderBottom: "1px solid var(--border-color)", color: row.overdueActive ? "var(--priority-urgent-text)" : undefined }}>{row.overdueActive}</td>
                    <td style={{ textAlign: "right", padding: "0.6rem", borderBottom: "1px solid var(--border-color)", color: row.mismatchCount ? "var(--priority-high-text)" : undefined }}>{row.mismatchCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </main>
  );
}
