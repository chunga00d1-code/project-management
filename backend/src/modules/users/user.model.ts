import type { Role } from "../../core/auth.js";
export interface UserModel {
  _id: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
}
