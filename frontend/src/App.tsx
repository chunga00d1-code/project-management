import { useState } from "react";
import { Login } from "./features/auth/Login";
import { TaskBoard } from "./features/tasks/TaskBoard";
import { Settings } from "./features/auth/Settings";
import { Users } from "./features/auth/Users";
import { Operations } from "./features/auth/Operations";
import { Projects } from "./features/auth/Projects";
import { hasPermission } from "./hooks/usePermission";
import { api } from "./api/client";

export function App() {
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem("token")));
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })() as { email?: string; role?: string };
  const [page, setPage] = useState<"tasks" | "projects" | "settings" | "users" | "operations">("tasks");
  const admin = hasPermission(user.role, "settings");
  
  const signOut = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setLoggedIn(false);
    }
  };

  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;

  return (
    <div className="app-container">
      <nav className="sidebar">
        <div className="brand">
          <span>🚀</span> PR Review Tasks
        </div>
        <button className={page === "tasks" ? "active" : ""} onClick={() => setPage("tasks")}>
          📋 Nhiệm vụ
        </button>
        <button className={page === "projects" ? "active" : ""} onClick={() => setPage("projects")}>
          📁 Dự án
        </button>
        {admin && (
          <button className={page === "settings" ? "active" : ""} onClick={() => setPage("settings")}>
            ⚙️ Cấu hình
          </button>
        )}
        {hasPermission(user.role, "users") && (
          <button className={page === "users" ? "active" : ""} onClick={() => setPage("users")}>
            👥 Thành viên
          </button>
        )}
        {admin && (
          <button className={page === "operations" ? "active" : ""} onClick={() => setPage("operations")}>
            🛠️ Vận hành
          </button>
        )}
        <button className="sign-out" onClick={() => void signOut()}>
          🚪 Đăng xuất
        </button>
      </nav>
      {page === "tasks" ? (
        <TaskBoard />
      ) : page === "projects" ? (
        <Projects />
      ) : page === "settings" && admin ? (
        <Settings />
      ) : page === "users" && hasPermission(user.role, "users") ? (
        <Users />
      ) : page === "operations" && admin ? (
        <Operations />
      ) : (
        <TaskBoard />
      )}
    </div>
  );
}
