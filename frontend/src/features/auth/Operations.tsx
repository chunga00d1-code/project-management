import { useEffect, useState } from "react";
import { api } from "../../api/client";
type Audit = { _id: string; at: string; actor?: string; action: string; target: string };
type Dead = { _id: string; type: string; attempts: number; lastError?: string; payload: { repository: string; number: number } };
export function Operations() {
  const [audit, setAudit] = useState<Audit[]>([]);
  const [jobs, setJobs] = useState<Dead[]>([]);
  const [error, setError] = useState("");

  const load = () =>
    Promise.all([
      api<{ items: Audit[] }>("/operations/audit"),
      api<Dead[]>("/operations/dead-letter"),
    ])
      .then(([a, j]) => {
        setAudit(a.items);
        setJobs(j);
      })
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    void load();
  }, []);

  return (
    <main>
      <header>
        <h2>Bảng Vận Hành Hệ Thống</h2>
      </header>

      {error && (
        <div className="error-message" style={{ margin: "1rem 0" }}>
          {error}
        </div>
      )}

      <div className="grid-2">
        {/* Left: Failed jobs (Dead Letter Queue) */}
        <div>
          <h3>⚠️ Hàng Đợi Thất Bại (Dead Letter Queue)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
            {jobs.map((job) => (
              <div key={job._id} className="project-card" style={{ margin: 0, gap: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="pill" style={{ textTransform: "uppercase", fontWeight: 700, background: "rgba(249, 115, 22, 0.1)", color: "#fb923c" }}>
                    {job.type}
                  </span>
                  <span className="pill" style={{ fontSize: "0.8rem" }}>
                    Thử lại: <strong>{job.attempts} lần</strong>
                  </span>
                </div>
                <div style={{ fontSize: "0.95rem" }}>
                  Kho mã nguồn: <strong>{job.payload.repository}</strong> <br />
                  Số PR: <strong>#{job.payload.number}</strong>
                </div>
                {job.lastError && (
                  <div
                    style={{
                      background: "rgba(239, 68, 68, 0.05)",
                      border: "1px solid rgba(239, 68, 68, 0.15)",
                      padding: "0.5rem",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.8rem",
                      color: "#f87171",
                      fontFamily: "monospace",
                      wordBreak: "break-all",
                    }}
                  >
                    Lỗi: {job.lastError}
                  </div>
                )}
                <button
                  className="btn-primary"
                  onClick={async () => {
                    await api(`/operations/dead-letter/${job._id}/retry`, { method: "POST" });
                    void load();
                  }}
                  style={{ width: "100%", padding: "0.5rem" }}
                >
                  🔄 Thực hiện lại (Retry)
                </button>
              </div>
            ))}
            {jobs.length === 0 && (
              <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem" }}>
                Không có job nào thất bại. Hệ thống vận hành tốt!
              </p>
            )}
          </div>
        </div>

        {/* Right: Audit Logs */}
        <div>
          <h3>📜 Nhật Ký Hoạt Động (Audit Log)</h3>
          <ul className="list-container" style={{ listStyle: "none", marginTop: "1rem", maxHeight: "600px", overflowY: "auto", paddingRight: "0.25rem" }}>
            {audit.map((item) => (
              <li
                key={item._id}
                className="project-card"
                style={{
                  margin: 0,
                  padding: "0.75rem 1rem",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: "0.5rem",
                  fontSize: "0.85rem",
                  borderLeft: "4px solid var(--primary-color)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                  <span>{new Date(item.at).toLocaleString("vi-VN")}</span>
                  <span className="pill" style={{ fontSize: "0.75rem", padding: "0.1rem 0.4rem" }}>
                    👤 {item.actor || "hệ thống"}
                  </span>
                </div>
                <div>
                  Hành động: <strong style={{ color: "var(--primary-color)" }}>{item.action}</strong>
                </div>
                <div style={{ color: "var(--text-secondary)", wordBreak: "break-all" }}>
                  Đối tượng: {item.target}
                </div>
              </li>
            ))}
            {audit.length === 0 && (
              <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem" }}>Chưa có nhật ký hoạt động nào.</p>
            )}
          </ul>
        </div>
      </div>
    </main>
  );
}
