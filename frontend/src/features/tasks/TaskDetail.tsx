import { useState } from "react";
import { api } from "../../api/client";
import type { Task } from "../../types";
import { EditTask } from "./EditTask";
export function TaskDetail({
  task,
  onClose,
  onChange,
}: {
  task: Task;
  onClose: () => void;
  onChange: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <dialog open>
      <h2>{task.title}</h2>
      <p>{task.description}</p>
      <EditTask task={task} onDone={onChange} />
      <h3>Comments</h3>
      <ul>
        {task.comments.map((c) => (
          <li key={c.id}>
            <b>{c.author}</b>: {c.text}
          </li>
        ))}
      </ul>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await api(`/tasks/${task._id}/comments`, {
            method: "POST",
            body: JSON.stringify({ text }),
          });
          setText("");
          onChange();
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment"
        />
        <button>Comment</button>
      </form>
      <button onClick={onClose}>Close</button>
    </dialog>
  );
}
