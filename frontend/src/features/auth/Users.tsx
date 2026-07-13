import { useEffect, useState } from "react";
import { api } from "../../api/client";
type User = { id: string; email: string; role: string; active: boolean; createdAt: string };
export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("developer");
  const [message, setMessage] = useState("");

  const load = () => api<User[]>("/auth/users").then(setUsers);
  useEffect(() => {
    void load();
  }, []);

  async function update(id: string, body: Record<string, unknown>) {
    try {
      await api(`/auth/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setMessage("Cập nhật thành viên thành công! Các phiên đăng nhập hiện tại đã bị hủy bỏ.");
      setTimeout(() => setMessage(""), 5000);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cập nhật thất bại");
    }
  }

  return (
    <main>
      <header>
        <h2>Quản Lý Thành Viên</h2>
      </header>

      {message && (
        <div className="error-message" style={{ margin: "1rem 0" }}>
          {message}
        </div>
      )}

      <div className="grid-2">
        {/* Left Column: Create User Form */}
        <div>
          <h3>👥 Thêm Thành Viên Mới</h3>
          <form
            className="project-card"
            style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem", maxWidth: "100%" }}
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
                setMessage("Tạo thành viên mới thành công!");
                setTimeout(() => setMessage(""), 3000);
                void load();
              } catch (error) {
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
            <button className="btn-primary">Tạo thành viên</button>
          </form>
        </div>

        {/* Right Column: Users List */}
        <div>
          <h3>📋 Danh Sách Thành Viên ({users.length})</h3>
          <ul className="list-container" style={{ listStyle: "none", marginTop: "1rem" }}>
            {users.map((user) => (
              <li key={user.id} className="project-card" style={{ margin: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <strong style={{ fontSize: "1.1rem" }}>{user.email}</strong>
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
                          alert("Mật khẩu phải dài tối thiểu 12 ký tự!");
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
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
