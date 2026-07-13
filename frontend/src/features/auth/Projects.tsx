import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useRealtimeRefresh } from "../../realtime/useRealtimeRefresh";
export type ProjectRole = "owner" | "manager" | "member" | "viewer";
export type Project = { _id: string; name: string; description: string; team?: string; members: { email: string; role: ProjectRole }[] };
export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [team, setTeam] = useState("");
  const [memberEmail, setMemberEmail] = useState<Record<string, string>>({});
  const [memberRole, setMemberRole] = useState<Record<string, ProjectRole>>({});
  const [message, setMessage] = useState("");

  const [showCreate, setShowCreate] = useState(false);

  const load = () => api<Project[]>("/projects").then(setProjects);
  useEffect(() => {
    void load();
  }, []);
  useRealtimeRefresh(["project."], () => void load());

  return (
    <main>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Quản Lý Dự Án</h2>
        <button className="btn-primary" style={{ width: "auto" }} onClick={() => setShowCreate(true)}>
          ➕ Tạo dự án mới
        </button>
      </header>

      {message && (
        <div className="error-message" style={{ margin: "1rem 0" }}>
          {message}
        </div>
      )}

      {/* Full width List of Projects */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <h3>📂 Danh Sách Dự Án ({projects.length})</h3>
        <div className="grid-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: "1.5rem" }}>
          {projects.map((project) => (
            <article key={project._id} className="project-card" style={{ margin: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h4 style={{ fontSize: "1.2rem", fontWeight: 700 }}>{project.name}</h4>
                  {project.team && (
                    <span className="pill" style={{ display: "inline-block", marginTop: "0.25rem", fontSize: "0.75rem" }}>
                      👥 Team: {project.team}
                    </span>
                  )}
                </div>
              </div>

              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.5rem", minHeight: "40px" }}>
                {project.description || "Không có mô tả."}
              </p>

              <div style={{ marginTop: "1rem" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>Thành viên:</span>
                <ul style={{ listStyle: "none", display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                  {project.members.map((member) => (
                    <li key={member.email} className="pill" style={{ fontSize: "0.75rem", display: "flex", gap: "0.5rem" }}>
                      <span>{member.email}</span>
                      <strong style={{ color: "var(--primary-color)" }}>({member.role})</strong>
                    </li>
                  ))}
                </ul>
              </div>

              <form
                style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem", borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const email = memberEmail[project._id];
                  if (!email) return;
                  try {
                    await api(`/projects/${project._id}/members/${encodeURIComponent(email)}`, {
                      method: "PUT",
                      body: JSON.stringify({ role: memberRole[project._id] || "member" }),
                    });
                    setMemberEmail({ ...memberEmail, [project._id]: "" });
                    setMessage("Cập nhật thành viên thành công!");
                    setTimeout(() => setMessage(""), 3000);
                    await load();
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Cập nhật thành viên thất bại");
                  }
                }}
              >
                <input
                  required
                  type="email"
                  placeholder="Email thành viên..."
                  value={memberEmail[project._id] || ""}
                  onChange={(e) => setMemberEmail({ ...memberEmail, [project._id]: e.target.value })}
                  style={{ flex: 2, padding: "0.5rem" }}
                />
                <select
                  value={memberRole[project._id] || "member"}
                  onChange={(e) => setMemberRole({ ...memberRole, [project._id]: e.target.value as ProjectRole })}
                  style={{ flex: 1, padding: "0.5rem" }}
                >
                  {["owner", "manager", "member", "viewer"].map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <button className="btn-primary" style={{ width: "auto", padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
                  + Thêm / Sửa
                </button>
              </form>
            </article>
          ))}
          {projects.length === 0 && (
            <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem", gridColumn: "1 / -1" }}>Chưa có dự án nào được tạo.</p>
          )}
        </div>
      </div>

      {showCreate && (
        <dialog open style={{ maxWidth: "550px", width: "95%", zIndex: 1100 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2>➕ Tạo Dự Án Mới</h2>
          </div>
          <form
            className="project-card"
            style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem", maxWidth: "100%", border: "none", padding: 0 }}
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/projects", {
                  method: "POST",
                  body: JSON.stringify({ name, description, team }),
                });
                setName("");
                setDescription("");
                setTeam("");
                setMessage("Tạo dự án thành công!");
                setTimeout(() => setMessage(""), 3000);
                setShowCreate(false);
                await load();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Tạo dự án thất bại");
              }
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Tên dự án *</label>
              <input
                required
                maxLength={120}
                placeholder="VD: Core API"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Mô tả dự án</label>
              <textarea
                maxLength={5000}
                placeholder="Nhập mô tả chi tiết..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ minHeight: "80px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Team phụ trách</label>
              <input
                maxLength={100}
                placeholder="VD: Tech Dev"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
              />
            </div>
            <div className="flex-row" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button type="button" className="btn-danger" style={{ width: "auto" }} onClick={() => setShowCreate(false)}>
                Hủy bỏ
              </button>
              <button className="btn-primary" style={{ width: "auto" }}>Tạo dự án</button>
            </div>
          </form>
        </dialog>
      )}
    </main>
  );
}
