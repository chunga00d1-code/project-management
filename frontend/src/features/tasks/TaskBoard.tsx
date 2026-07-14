import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Task } from "../../types";
import { TaskCard } from "../../components/TaskCard";
import { CreateTask } from "./CreateTask";
import { TaskDashboard } from "./TaskDashboard";
import { TaskDetail } from "./TaskDetail";
import { emptyTaskQuery, TaskFilters, type TaskQuery } from "./TaskFilters";
import { KanbanStatusSwitcher } from "./KanbanStatusSwitcher";
import { useIsCompact, useIsMobileLayout } from "../../hooks/useMediaQuery";
import { ServerDashboard } from "./ServerDashboard";
type Page = { items: Task[]; total: number; page: number; pages: number };
type StatusChange = { id: string; status: string };
const statuses = ["todo", "in_review", "needs_changes", "ready", "done", "cancelled"];
const labels: Record<string, string> = { todo: "📋 Cần làm", in_review: "🔍 Đang review", needs_changes: "⚠️ Cần sửa đổi", ready: "✅ Sẵn sàng", done: "🎉 Hoàn thành", cancelled: "🚫 Đã hủy" };
export function TaskBoard() {
  const client = useQueryClient();
  const isMobile = useIsMobileLayout();
  const isCompact = useIsCompact();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState<TaskQuery>(emptyTaskQuery);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeStatus, setActiveStatus] = useState(statuses[0]);
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ ...Object.fromEntries(Object.entries(query).filter(([, value]) => value)), page: String(page), limit: "60" });
  const queryKey = ["tasks", query, page] as const;
  const tasksQuery = useQuery({ queryKey, queryFn: () => api<Page>(`/tasks/search?${params}`), refetchInterval: 60000 });
  const data = tasksQuery.data;
  const tasks = data?.items || [];
  const selected = tasks.find((task) => task._id === selectedId);
  const statusMutation = useMutation({ mutationFn: ({ id, status }: StatusChange) => api(`/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }), onMutate: async ({ id, status }) => { await client.cancelQueries({ queryKey: ["tasks"] }); const previous = client.getQueriesData<Page>({ queryKey: ["tasks"] }); client.setQueriesData<Page>({ queryKey: ["tasks"] }, (old) => old ? { ...old, items: old.items.map((task) => task._id === id ? { ...task, status } : task) } : old); return { previous }; }, onError: (_error, _variables, context) => { for (const [key, value] of context?.previous || []) client.setQueryData(key, value); }, onSettled: () => { void client.invalidateQueries({ queryKey: ["tasks"] }); void client.invalidateQueries({ queryKey: ["dashboard"] }); } });
  const deleteMutation = useMutation({ mutationFn: (id: string) => api(`/tasks/${id}`, { method: "DELETE" }), onSuccess: () => { setSelectedId(null); void client.invalidateQueries({ queryKey: ["tasks"] }); void client.invalidateQueries({ queryKey: ["dashboard"] }); } });
  const refresh = () => { void client.invalidateQueries({ queryKey: ["tasks"] }); void client.invalidateQueries({ queryKey: ["dashboard"] }); };
  const changeQuery = (next: TaskQuery) => { setPage(1); setQuery(next); };
  const error = tasksQuery.error || statusMutation.error || deleteMutation.error;
  const statusOptions = statuses.map((id) => ({ id, label: labels[id], count: tasks.filter((task) => task.status === id).length }));
  const visibleStatuses = isMobile ? statuses.filter((status) => status === activeStatus) : statuses;
  const usesStatusTabs = isMobile && !isCompact;

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Bảng nhiệm vụ</h1>
          <p className="page-subtitle">Theo dõi tiến độ và cập nhật công việc theo thời gian thực.</p>
        </div>
        <button className="btn-primary" style={{ width: "auto" }} onClick={() => setShowCreate(true)}>
          ➕ Tạo nhiệm vụ mới
        </button>
      </header>

      <div className="grid-2">
        <TaskDashboard tasks={tasks} />
        <ServerDashboard />
      </div>

      <TaskFilters value={query} onChange={changeQuery} mobileOpen={filtersOpen} onMobileOpenChange={setFiltersOpen} />
      {isMobile && <KanbanStatusSwitcher statuses={statusOptions} activeStatus={activeStatus} onChange={setActiveStatus} compact={isCompact} />}

      {error && <div className="error-message" role="alert">{error instanceof Error ? error.message : "Không thể cập nhật dữ liệu"}</div>}
      {statusMutation.isPending && <div className="toast-message">Đang đồng bộ thay đổi…</div>}

      {tasksQuery.isLoading ? (
        <div className="kanban-loading">
          {visibleStatuses.map((status) => (
            <div className="kanban-column skeleton-column" key={status}>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      ) : (
        <section className="kanban-grid">
          {visibleStatuses.map((status) => {
            const column = tasks.filter((task) => task.status === status);
            return (
              <div
                key={status}
                className="kanban-column"
                id={`kanban-panel-${status}`}
                role={usesStatusTabs ? "tabpanel" : isCompact ? "region" : undefined}
                aria-labelledby={usesStatusTabs ? `kanban-tab-${status}` : isCompact ? `kanban-heading-${status}` : undefined}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const id = event.dataTransfer.getData("taskId");
                  if (id) statusMutation.mutate({ id, status });
                }}
              >
                <h2 id={`kanban-heading-${status}`}>
                  {labels[status]} <span className="counter">{column.length}</span>
                </h2>
                {column.length === 0 && <div className="column-empty">Chưa có nhiệm vụ</div>}
                {column.map((task) => (
                  <TaskCard
                    key={task._id}
                    task={task}
                    onStatus={(next) => statusMutation.mutate({ id: task._id, status: next })}
                    onOpen={() => setSelectedId(task._id)}
                    onDelete={() => {
                      if (confirm(`Bạn chắc chắn muốn xóa nhiệm vụ "${task.title}"?`)) {
                        deleteMutation.mutate(task._id);
                      }
                    }}
                  />
                ))}
              </div>
            );
          })}
        </section>
      )}

      <div className="pagination-bar">
        <span>Tổng số <strong>{data?.total || 0}</strong> nhiệm vụ · Trang <strong>{page}</strong>/{data?.pages || 1}</span>
        <div>
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Trang trước</button>
          <button className="btn-primary" disabled={!data || page >= data.pages} onClick={() => setPage((value) => value + 1)}>Trang sau →</button>
        </div>
      </div>

      {showCreate && (<CreateTask
            onCreated={() => {
              setShowCreate(false);
              refresh();
            }}
            onCancel={() => setShowCreate(false)}
          />)}

      {selected && <TaskDetail task={selected} onClose={() => setSelectedId(null)} onChange={refresh} />}
    </main>
  );
}
