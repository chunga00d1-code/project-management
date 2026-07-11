import { useEffect, useState } from "react";
import { api } from "../../api/client";
type Dashboard = {
  total: number;
  active: number;
  needsChanges: number;
  overdue: number;
  byRepository: { repository: string; count: number }[];
};
export function ServerDashboard() {
  const [value, setValue] = useState<Dashboard>();
  useEffect(() => {
    void api<Dashboard>("/tasks/dashboard").then(setValue);
  }, []);
  if (!value) return null;
  return (
    <section>
      <strong>Total: {value.total}</strong>
      <strong>Active: {value.active}</strong>
      <strong>Needs changes: {value.needsChanges}</strong>
      <strong>Overdue: {value.overdue}</strong>
      <ul>
        {value.byRepository.map((item) => (
          <li key={item.repository}>
            {item.repository}: {item.count}
          </li>
        ))}
      </ul>
    </section>
  );
}
