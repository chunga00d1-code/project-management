export type Role = "superadmin" | "admin" | "manager" | "developer";
export interface User {
  id: string;
  email: string;
  role: Role;
}
export interface Task {
  _id: string;
  code?: string;
  title: string;
  description: string;
  assignee: string;
  status: string;
  priority: string;
  labels: string[];
  project?: string;
  projectId?: string;
  sprint?: string;
  team?: string;
  dueDate?: string;
  comments: { id: string; text: string; author: string; at: string }[];
  checklist?: { id: string; text: string; done: boolean; createdAt: string }[];
  dependencies?: string[];
  watchers?: string[];
  prSyncStatus?: "matched" | "mismatched";
  prMismatchReasons?: string[];
}



