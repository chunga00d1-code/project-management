import { hasAction, registerAction } from "../action-registry.js";
import type { ActionType } from "../automation.model.js";
import { createTaskActions, type AlertPort, type TaskActionPort } from "./task.actions.js";
import { createGithubActions, type GithubActionPort } from "./github.actions.js";
import { createNotificationActions, type NotificationActionPort } from "./notification.actions.js";
import { createOperationsActions, type JobActionPort } from "./operations.actions.js";

export interface AutomationActionDependencies {
  tasks: TaskActionPort;
  github: GithubActionPort;
  notifications: NotificationActionPort;
  jobs: JobActionPort;
  alerts: AlertPort;
}

export function registerAutomationActions(dependencies: AutomationActionDependencies): void {
  const actions = [
    ...createTaskActions(dependencies),
    ...createGithubActions(dependencies),
    ...createNotificationActions(dependencies),
    ...createOperationsActions(dependencies),
  ];
  for (const action of actions) {
    if (!hasAction(action.type as ActionType)) registerAction(action);
  }
}
