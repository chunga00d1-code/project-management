import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import type { Task } from "../../types";
import { TaskCard } from "../../components/TaskCard";
import { CreateTask } from "./CreateTask";
import { TaskDashboard } from "./TaskDashboard";
import { TaskDetail } from "./TaskDetail";
import { useState } from "react";
import { TaskFilters, type TaskQuery } from "./TaskFilters";
import { ServerDashboard } from "./ServerDashboard";

type Page = { items: Task[]; total: number; page: number; pages: number };

export function TaskBoard() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState<TaskQuery>({ q: "", priority: "", project: "" });
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({
    ...Object.fromEntries(Object.entries(query).filter(([, value]) => value)),
    page: String(page),
    limit: "60",
  });
  const { data, error, refresh } = useAsync(() => api<Page>(`/tasks/search?${params}`), [query.q, query.priority, query.project, page]);
  const tasks = data?.items || [];
  const selected = tasks.find((task) => task._id === selectedId);

  const changeQuery = (next: TaskQuery) => {
    setPage(1);
    setQuery(next);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "todo": return "📋 Cần làm";
      case "in_review": return "🔍 Đang review";
      case "needs_changes": return "⚠️ Cần sửa đổi";
      case "ready": return "✅ Sẵn sàng";
      case "done": return "🎉 Hoàn thành";
      case "cancelled": return "🚫 Đã hủy";
      default: return status;
    }
  };

  const statuses = ["todo", "in_review", "needs_changes", "ready", "done", "cancelled"];

  return (
    <main>
      <header>
        <h1>Bảng Nhiệm Vụ</h1>
      </header>

      <div className="grid-2">
        <TaskDashboard tasks={tasks} />
        <ServerDashboard />
      </div>

      <CreateTask onCreated={refresh} />
      
      <TaskFilters onChange={changeQuery} />

      {error && <div className="error-message" style={{ margin: "1rem 0" }}>{error}</div>}

      <section className="kanban-grid">
        {statuses.map((status) => {
          const colTasks = tasks.filter((t) => t.status === status);
          return (
            <div
              key={status}
              className="kanban-column"
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                const id = e.dataTransfer.getData("taskId");
                if (id) {
                  await api(`/tasks/${id}/status`, {
                    method: "PATCH",
                    body: JSON.stringify({ status }),
                  });
                  void refresh();
                }
              }}
            >
              <h2>
                {getStatusLabel(status)}{" "}
                <span className="counter">{colTasks.length}</span>
              </h2>
              {colTasks.map((task) => (
                <TaskCard
                  key={task._id}
                  task={task}
                  onStatus={async (value) => {
                    await api(`/tasks/${task._id}/status`, {
                      method: "PATCH",
                      body: JSON.stringify({ status: value }),
                    });
                    void refresh();
                  }}
                  onOpen={() => setSelectedId(task._id)}
                  onDelete={async () => {
                    if (confirm(`Bạn chắc chắn muốn xóa nhiệm vụ "${task.title}"?`)) {
                      await api(`/tasks/${task._id}`, { method: "DELETE" });
                      void refresh();
                    }
                  }}
                />
              ))}
            </div>
          );
        })}
      </section>

      <div className="filter-bar" style={{ justifyContent: "space-between", marginTop: "1rem" }}>
        <span style={{ color: "var(--text-secondary)" }}>
          Tổng số: <strong>{data?.total || 0}</strong> nhiệm vụ · Trang <strong>{page}</strong> / <strong>{data?.pages || 1}</strong>
        </span>
        <div className="flex-row" style={{ gap: "0.5rem" }}>
          <button
            className="btn-primary"
            style={{ width: "auto", padding: "0.5rem 1rem" }}
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            ◀ Trang trước
          </button>
          <button
            className="btn-primary"
            style={{ width: "auto", padding: "0.5rem 1rem" }}
            disabled={!data || page >= data.pages}
            onClick={() => setPage(page + 1)}
          >
            Trang sau ▶
          </button>
        </div>
      </div>

      {selected && (
        <TaskDetail
          task={selected}
          onClose={() => setSelectedId(null)}
          onChange={refresh}
        />
      )}
    </main>
  );
}

