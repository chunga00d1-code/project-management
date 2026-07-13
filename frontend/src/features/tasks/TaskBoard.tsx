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
  const [selectedId, setSelectedId] = useState<string | null>(null); const [query, setQuery] = useState<TaskQuery>({ q: "", priority: "", project: "" }); const [page, setPage] = useState(1);
  const params = new URLSearchParams({ ...Object.fromEntries(Object.entries(query).filter(([, value]) => value)), page: String(page), limit: "60" });
  const { data, error, refresh } = useAsync(() => api<Page>(`/tasks/search?${params}`), [query.q, query.priority, query.project, page]); const tasks = data?.items || []; const selected = tasks.find((task) => task._id === selectedId);
  const changeQuery = (next: TaskQuery) => { setPage(1); setQuery(next); };
  return <main><header><h1>Task board</h1></header><TaskDashboard tasks={tasks} /><ServerDashboard /><CreateTask onCreated={refresh} /><TaskFilters onChange={changeQuery} /><section>{["todo", "in_review", "needs_changes", "ready", "done", "cancelled"].map((status) => <div key={status} onDragOver={(e) => e.preventDefault()} onDrop={async (e) => { const id = e.dataTransfer.getData("taskId"); if (id) { await api(`/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); void refresh(); } }}><h2>{status}</h2>{tasks.filter((t) => t.status === status).map((task) => <TaskCard key={task._id} task={task} onStatus={async (value) => { await api(`/tasks/${task._id}/status`, { method: "PATCH", body: JSON.stringify({ status: value }) }); void refresh(); }} onOpen={() => setSelectedId(task._id)} onDelete={async () => { if (confirm(`Delete ${task.title}?`)) { await api(`/tasks/${task._id}`, { method: "DELETE" }); void refresh(); } }} />)}</div>)}</section><p>{error}</p><p>{data?.total || 0} tasks · page {page} / {data?.pages || 1} <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button> <button disabled={!data || page >= data.pages} onClick={() => setPage(page + 1)}>Next</button></p>{selected && <TaskDetail task={selected} onClose={() => setSelectedId(null)} onChange={refresh} />}</main>;
}

