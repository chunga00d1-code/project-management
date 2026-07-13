import type { Role } from "../../core/auth.js";
export interface UserModel { _id: string; email: string; passwordHash: string; role: Role; active: boolean; tokenVersion?: number; createdAt: string; }
