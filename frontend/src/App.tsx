import { useState } from "react";
import { Login } from "./features/auth/Login";
import { TaskBoard } from "./features/tasks/TaskBoard";
import { Settings } from "./features/auth/Settings";
import { Users } from "./features/auth/Users";
export function App() {
  const [loggedIn, setLoggedIn] = useState(
    Boolean(localStorage.getItem("token")),
  );
  const [page, setPage] = useState<"tasks" | "settings" | "users">("tasks");
  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;
  return (
    <>
      <nav>
        <button onClick={() => setPage("tasks")}>Tasks</button>
        <button onClick={() => setPage("settings")}>Settings</button>
        <button onClick={() => setPage("users")}>Users</button>
        <button
          onClick={() => {
            localStorage.removeItem("token");
            setLoggedIn(false);
          }}
        >
          Sign out
        </button>
      </nav>
      {page === "tasks" ? (
        <TaskBoard />
      ) : page === "settings" ? (
        <Settings />
      ) : (
        <Users />
      )}
    </>
  );
}
