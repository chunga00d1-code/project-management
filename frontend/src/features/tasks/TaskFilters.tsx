import { useState } from "react";
export type TaskQuery = { q: string; priority: string; project: string };
export function TaskFilters({ onChange }: { onChange: (query: TaskQuery) => void }) {
  const [query, setQuery] = useState<TaskQuery>({ q: "", priority: "", project: "" });
  const update = (next: TaskQuery) => { setQuery(next); onChange(next); };
  return <div><input placeholder="Search tasks" value={query.q} onChange={(e) => update({ ...query, q: e.target.value })} /><select value={query.priority} onChange={(e) => update({ ...query, priority: e.target.value })}><option value="">All priorities</option>{["low", "medium", "high", "urgent"].map((x) => <option key={x}>{x}</option>)}</select><input placeholder="Project" value={query.project} onChange={(e) => update({ ...query, project: e.target.value })} /></div>;
}
