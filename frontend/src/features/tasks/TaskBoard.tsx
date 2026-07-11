import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import type { Task } from "../../types";
import { TaskCard } from "../../components/TaskCard";
import { CreateTask } from "./CreateTask";
import { TaskDashboard } from "./TaskDashboard";
import { TaskDetail } from "./TaskDetail";
import { useState } from "react";
import { TaskFilters } from "./TaskFilters";
import { ServerDashboard } from "./ServerDashboard";
export function TaskBoard() {
  const [selected, setSelected] = useState<Task | null>(null);
  const [filtered, setFiltered] = useState<Task[]>([]);
  const {
    data: tasks = [],
    error,
    refresh,
  } = useAsync(() => api<Task[]>("/tasks"), []);
  return (
    <main>
      <header>
        <h1>Task board</h1>
        <button
          onClick={() => {
            localStorage.removeItem("token");
            location.reload();
          }}
        >
          Sign out
        </button>
      </header>
      <TaskDashboard tasks={tasks} />
      <ServerDashboard />
      <CreateTask onCreated={refresh} />
      <TaskFilters tasks={tasks} onChange={setFiltered} />
      <section>
        {[
          "todo",
          "in_review",
          "needs_changes",
          "ready",
          "done",
          "cancelled",
        ].map((status) => (
          <div
            key={status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              const id = e.dataTransfer.getData("taskId");
              if (id) {
                await api(`/tasks/${id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ status }),
                });
                void refresh();
              }
            }}
          >
            <h2>{status}</h2>
            {filtered
              .filter((t) => t.status === status)
              .map((task) => (
                <TaskCard
                  key={task._id}
                  task={task}
                  onStatus={async (value) => {
                    await api(`/tasks/${task._id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ status: value }),
                    });
                    void refresh();
                  }}
                  onOpen={() => setSelected(task)}
                  onDelete={async () => {
                    if (confirm(`Delete ${task.title}?`)) {
                      await api(`/tasks/${task._id}`, { method: "DELETE" });
                      void refresh();
                    }
                  }}
                />
              ))}
          </div>
        ))}
      </section>
      <p>{error}</p>
      {selected && (
        <TaskDetail
          task={selected}
          onClose={() => setSelected(null)}
          onChange={refresh}
        />
      )}
    </main>
  );
}
