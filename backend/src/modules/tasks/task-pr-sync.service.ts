import { resolveGithubToken } from "../github-app/github-token.service.js";
import type { TaskModel } from "./task.model.js";

export async function syncTaskStatusToGithub(task: TaskModel, previousStatus?: string) {
  if (!task.repository || !task.pullRequestNumber) return;
  if (task.status === previousStatus) return;
  if (!["done", "cancelled"].includes(task.status)) return;

  const token = await resolveGithubToken(task.repository);
  const base = `https://api.github.com/repos/${task.repository}`;
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "content-type": "application/json",
  };
  const commentBody =
    task.status === "done"
      ? `✅ Task ${task.code} đã được đánh dấu hoàn thành.`
      : `🚫 Task ${task.code} đã bị hủy — đóng Pull Request này.`;

  const comment = await fetch(`${base}/issues/${task.pullRequestNumber}/comments`, {
    method: "POST",
    headers,
    body: JSON.stringify({ body: commentBody }),
  });
  if (!comment.ok) throw new Error(`GitHub comment HTTP ${comment.status}`);

  if (task.status === "cancelled") {
    const close = await fetch(`${base}/pulls/${task.pullRequestNumber}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ state: "closed" }),
    });
    if (!close.ok) throw new Error(`GitHub close PR HTTP ${close.status}`);
  }
}
