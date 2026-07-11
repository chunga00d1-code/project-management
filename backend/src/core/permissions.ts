import type { Role } from "./auth.js";
const access: Record<Role, string[]> = {
  superadmin: ["*"],
  admin: ["tasks:write", "settings:write", "users:write"],
  manager: ["tasks:write"],
  developer: ["tasks:status"],
};
export function can(role: Role, permission: string) {
  return access[role].includes("*") || access[role].includes(permission);
}
