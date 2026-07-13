import { useState } from "react";
export type TaskQuery = { q: string; priority: string; project: string };
export function TaskFilters({ onChange }: { onChange: (query: TaskQuery) => void }) {
  const [query, setQuery] = useState<TaskQuery>({ q: "", priority: "", project: "" });
  const update = (next: TaskQuery) => { setQuery(next); onChange(next); };
  return <div className="filter-bar"><input placeholder="Tìm kiếm nhiệm vụ..." value={query.q} onChange={(e) => update({ ...query, q: e.target.value })} /><select value={query.priority} onChange={(e) => update({ ...query, priority: e.target.value })}><option value="">Tất cả mức độ ưu tiên</option>{["low", "medium", "high", "urgent"].map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>)}</select><input placeholder="Dự án..." value={query.project} onChange={(e) => update({ ...query, project: e.target.value })} /></div>;
}
