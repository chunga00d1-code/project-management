import { useState } from "react";
import { api } from "../../api/client";
export function CreateTask({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [labels, setLabels] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await api("/tasks", {
          method: "POST",
          body: JSON.stringify({
            title,
            priority,
            dueDate,
            labels: labels
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          }),
        });
        setTitle("");
        onCreated();
      }}
    >
      <input
        required
        placeholder="New task"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <select value={priority} onChange={(e) => setPriority(e.target.value)}>
        {["low", "medium", "high", "urgent"].map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />
      <input
        placeholder="labels, separated"
        value={labels}
        onChange={(e) => setLabels(e.target.value)}
      />
      <button>Create</button>
    </form>
  );
}
