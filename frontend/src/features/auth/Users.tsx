import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useRealtimeRefresh } from "../../realtime/useRealtimeRefresh";

type User = { id: string; email: string; role: string; active: boolean; createdAt: string };

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("developer");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [showCreate, setShowCreate] = useState(false);

  const load = () => api<User[]>("/auth/users").then(setUsers);
  useEffect(() => {
    void load();
  }, []);
  useRealtimeRefresh(["user."], () => void load());

  async function update(id: string, body: Record<string, unknown>) {
    try {
      await api(`/auth/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setMessageType("success");
      setMessage("Cập nhật thành viên thành công! Các phiên đăng nhập hiện tại đã bị hủy bỏ.");
      setTimeout(() => setMessage(""), 5000);
      await load();
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Cập nhật thất bại");
    }
  }

  return (
    <main>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Quản Lý Thành Viên</h2>
        <button className="btn-primary" style={{ width: "auto" }} onClick={() => setShowCreate(true)}>
          ➕ Thêm thành viên
        </button>
      </header>

      {message && (
        <div className={messageType === "success" ? "success-message" : "error-message"} style={{ margin: "1rem 0" }}>
          {message}
        </div>
      )}

      {/* Grid of Users List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <h3>📋 Danh Sách Thành Viên ({users.length})</h3>
        <div className="grid-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "1.5rem" }}>
          {users.map((user) => (
            <article key={user.id} className="project-card" style={{ margin: 0, gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <strong style={{ fontSize: "1.1rem", wordBreak: "break-all" }}>{user.email}</strong>
                <div className="flex-row" style={{ gap: "0.5rem" }}>
                  <span className={`pill ${user.active ? "active" : "disabled"}`}>
                    {user.active ? "Đang hoạt động" : "Bị vô hiệu hóa"}
                  </span>
                  <span className="pill">
                    Vai trò: <strong>{user.role}</strong>
                  </span>
                </div>
              </div>

              <div className="flex-row" style={{ gap: "0.5rem", marginTop: "0.5rem" }}>
                <select
                  disabled={user.role === "superadmin"}
                  value={user.role}
                  onChange={(e) => void update(user.id, { role: e.target.value })}
                  style={{ padding: "0.4rem", fontSize: "0.85rem", width: "auto" }}
                >
                  {["superadmin", "admin", "manager", "developer"].map((item) => (
                    <option key={item} value={item}>
                      {item.toUpperCase()}
                    </option>
                  ))}
                </select>

                <button
                  className="btn-danger"
                  disabled={user.role === "superadmin"}
                  onClick={() => void update(user.id, { active: !user.active })}
                  style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", width: "auto" }}
                >
                  {user.active ? "Vô hiệu hóa" : "Kích hoạt"}
                </button>

                <button
                  className="btn-primary"
                  onClick={() => {
                    const next = prompt("Nhập mật khẩu mới (tối thiểu 12 ký tự):");
                    if (next) {
                      if (next.length < 12) {
                        setMessageType("error");
                        setMessage("Mật khẩu phải dài tối thiểu 12 ký tự!");
                        setTimeout(() => setMessage(""), 3000);
                      } else {
                        void update(user.id, { password: next });
                      }
                    }
                  }}
                  style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", width: "auto" }}
                >
                  Đặt lại MK
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {showCreate && (
        <dialog open style={{ maxWidth: "550px", width: "95%", zIndex: 1100 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2>➕ Thêm Thành Viên Mới</h2>
          </div>
          <form
            className="project-card"
            style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem", maxWidth: "100%", border: "none", padding: 0 }}
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/auth/users", {
                  method: "POST",
                  body: JSON.stringify({ email, password, role }),
                });
                setEmail("");
                setPassword("");
                setRole("developer");
                setMessageType("success");
                setMessage("Tạo thành viên mới thành công!");
                setTimeout(() => setMessage(""), 3000);
                setShowCreate(false);
                void load();
              } catch (error) {
                setMessageType("error");
                setMessage(error instanceof Error ? error.message : "Thêm thành viên thất bại");
              }
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Email đăng nhập *</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="VD: user@company.com"
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Mật khẩu khởi tạo *</label>
              <input
                required
                minLength={12}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 12 ký tự"
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Vai trò hệ thống</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {["admin", "manager", "developer"].map((item) => (
                  <option key={item} value={item}>
                    {item.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-row" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button type="button" className="btn-danger" style={{ width: "auto" }} onClick={() => setShowCreate(false)}>
                Hủy bỏ
              </button>
              <button className="btn-primary" style={{ width: "auto" }}>Tạo thành viên</button>
            </div>
          </form>
        </dialog>
      )}
    </main>
  );
}
