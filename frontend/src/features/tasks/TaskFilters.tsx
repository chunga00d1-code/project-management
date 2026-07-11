import { useEffect, useMemo, useState } from "react";
import type { Task } from "../../types";
export function TaskFilters({
  tasks,
  onChange,
}: {
  tasks: Task[];
  onChange: (items: Task[]) => void;
}) {
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState("");
  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (!q || JSON.stringify(t).toLowerCase().includes(q.toLowerCase())) &&
          (!priority || t.priority === priority),
      ),
    [tasks, q, priority],
  );
  useEffect(() => onChange(filtered), [filtered, onChange]);
  return (
    <div>
      <input
        placeholder="Search tasks"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select value={priority} onChange={(e) => setPriority(e.target.value)}>
        <option value="">All priorities</option>
        {["low", "medium", "high", "urgent"].map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </div>
  );
}
