export function hasPermission(
  role: string | undefined,
  permission: "settings" | "users" | "tasks" | "performance",
) {
  const map: Record<string, string[]> = {
    superadmin: ["settings", "users", "tasks", "performance"],
    admin: ["settings", "users", "tasks", "performance"],
    manager: ["tasks", "performance"],
    developer: ["tasks"],
  };
  return Boolean(role && map[role]?.includes(permission));
}
