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
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem("token"))); const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } })() as { role?: string }; const [page, setPage] = useState<"tasks" | "projects" | "settings" | "users" | "operations">("tasks"); const admin = hasPermission(user.role, "settings"); const signOut = async () => { try { await api("/auth/logout", { method: "POST" }); } finally { localStorage.removeItem("token"); localStorage.removeItem("user"); setLoggedIn(false); } };
  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;
  return <><nav><button onClick={() => setPage("tasks")}>Tasks</button><button onClick={() => setPage("projects")}>Projects</button>{admin && <button onClick={() => setPage("settings")}>Settings</button>}{hasPermission(user.role, "users") && <button onClick={() => setPage("users")}>Users</button>}{admin && <button onClick={() => setPage("operations")}>Operations</button>}<button onClick={() => void signOut()}>Sign out</button></nav>{page === "tasks" ? <TaskBoard /> : page === "projects" ? <Projects /> : page === "settings" && admin ? <Settings /> : page === "users" && hasPermission(user.role, "users") ? <Users /> : page === "operations" && admin ? <Operations /> : <TaskBoard />}</>;
}
