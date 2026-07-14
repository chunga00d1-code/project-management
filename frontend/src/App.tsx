import { useState } from "react";
import { Login } from "./features/auth/Login";
import { TaskBoard } from "./features/tasks/TaskBoard";
import { Settings } from "./features/auth/Settings";
import { Users } from "./features/auth/Users";
import { Operations } from "./features/auth/Operations";
import { Projects } from "./features/auth/Projects";
import { hasPermission } from "./hooks/usePermission";
import { api } from "./api/client";
import { RealtimeProvider } from "./realtime/RealtimeProvider";
import { LocalizedLandingPage } from "./features/landing/LocalizedLandingPage";
import { Overview } from "./features/overview/Overview";
import { AppShell } from "./components/layout/AppShell";
export type Page = "overview" | "tasks" | "projects" | "settings" | "users" | "operations";
const navItems: { id: Page; label: string; icon: string; permission?: "admin" | "users" }[] = [
  { id: "overview", label: "Tổng quan", icon: "◈" },
  { id: "tasks", label: "Nhiệm vụ", icon: "▦" },
  { id: "projects", label: "Dự án", icon: "◇" },
  { id: "settings", label: "Cấu hình", icon: "⚙", permission: "admin" },
  { id: "users", label: "Thành viên", icon: "♙", permission: "users" },
  { id: "operations", label: "Vận hành", icon: "⌁", permission: "admin" },
];
export function App() {
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem("token")));
  const [showLogin, setShowLogin] = useState(false);
  const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } })() as { email?: string; role?: string };
  const [page, setPage] = useState<Page>("overview");
  const admin = hasPermission(user.role, "settings");
  const signOut = async () => { try { await api("/auth/logout", { method: "POST" }); } finally { localStorage.removeItem("token"); localStorage.removeItem("user"); setLoggedIn(false); } };
  if (!loggedIn) return showLogin
    ? <Login onLogin={() => setLoggedIn(true)} />
    : <LocalizedLandingPage onLogin={() => setShowLogin(true)} />;
  const visibleNav = navItems.filter((item) => !item.permission || (item.permission === "admin" ? admin : hasPermission(user.role, "users")));
  const content = page === "overview" ? <Overview onNavigate={setPage} /> : page === "tasks" ? <TaskBoard /> : page === "projects" ? <Projects /> : page === "settings" && admin ? <Settings /> : page === "users" && hasPermission(user.role, "users") ? <Users /> : page === "operations" && admin ? <Operations /> : <Overview onNavigate={setPage} />;
  return <RealtimeProvider><AppShell items={visibleNav} activePage={page} onNavigate={setPage} user={user} onSignOut={() => void signOut()}>{content}</AppShell></RealtimeProvider>;
}
