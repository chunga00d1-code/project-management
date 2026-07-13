import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { database } from "../../core/database.js";
import type { Role } from "../../core/auth.js";
import type { UserModel } from "./user.model.js";
export class UserService {
  private async col() { return (await database()).collection<UserModel>("users"); }
  async bootstrap(email: string, password: string) { const col = await this.col(); if (await col.countDocuments()) return; await col.insertOne({ _id: randomUUID(), email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12), role: "superadmin", active: true, tokenVersion: 0, createdAt: new Date().toISOString() }); }
  async login(email: string, password: string) { const user = await (await this.col()).findOne({ email: email.toLowerCase() }); if (!user || user.active === false || !(await bcrypt.compare(password, user.passwordHash))) return null; return user; }
  async find(id: string) { return (await this.col()).findOne({ _id: id }); }
  async list() { return (await (await this.col()).find({}, { projection: { passwordHash: 0 } }).sort({ createdAt: -1 }).toArray()).map((user) => ({ id: user._id, email: user.email, role: user.role, active: user.active !== false, createdAt: user.createdAt })); }
  async update(id: string, input: { role?: Role; active?: boolean; password?: string }) { const col = await this.col(); const user = await col.findOne({ _id: id }); if (!user) return null; const changes: Partial<UserModel> = {}; if (input.role) changes.role = input.role; if (input.active !== undefined) changes.active = input.active; if (input.password) changes.passwordHash = await bcrypt.hash(input.password, 12); await col.updateOne({ _id: id }, { $set: changes, $inc: { tokenVersion: 1 } }); return col.findOne({ _id: id }, { projection: { passwordHash: 0 } }); }
  async create(email: string, password: string, role: Role) { const col = await this.col(); const user: UserModel = { _id: randomUUID(), email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12), role, active: true, tokenVersion: 0, createdAt: new Date().toISOString() }; await col.insertOne(user); return { _id: user._id, email: user.email, role: user.role, active: user.active }; }
}
