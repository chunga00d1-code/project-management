import { registerAction } from "../action-registry.js";
import { createTaskActions, type AlertPort, type TaskActionPort } from "./task.actions.js";
import { createGithubActions, type GithubActionPort } from "./github.actions.js";
import { createNotificationActions, type NotificationActionPort } from "./notification.actions.js";
import { createOperationsActions, type JobActionPort } from "./operations.actions.js";
export interface AutomationActionDependencies { tasks: TaskActionPort; github: GithubActionPort; notifications: NotificationActionPort; jobs: JobActionPort; alerts: AlertPort }
let registered = false;
export function registerAutomationActions(deps: AutomationActionDependencies): void { if (registered) return; for (const action of [...createTaskActions(deps), ...createGithubActions(deps), ...createNotificationActions(deps), ...createOperationsActions(deps)]) registerAction(action); registered = true; }
