export type TaskStatus =
  "todo" | "in_review" | "needs_changes" | "ready" | "done" | "cancelled";
export type Priority = "low" | "medium" | "high" | "urgent";
export interface TaskModel {
  _id: string;
  title: string;
  description: string;
  assignee: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string;
  labels: string[];
  project?: string;
  projectId?: string;
  sprint?: string;
  team?: string;
  repository?: string;
  pullRequestNumber?: number;
  activities: { id: string; message: string; at: string }[];
  comments: { id: string; text: string; author: string; at: string }[];
  checklist: { id: string; text: string; done: boolean; createdAt: string }[];
  dependencies: string[];
  watchers: string[];
  deadlineNotificationKeys?: string[];
  createdAt: string;
  updatedAt: string;
}




