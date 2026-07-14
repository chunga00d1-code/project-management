import { randomUUID } from "crypto";
import { database } from "../../core/database.js";
export type ProjectRole = "owner" | "manager" | "member" | "viewer";
export interface Project { _id: string; name: string; description: string; team?: string; members: { email: string; role: ProjectRole }[]; createdAt: string; updatedAt: string; repositoryFullName?: string; installationId?: number; }
export class ProjectService {
  private async col() { return (await database()).collection<Project>("projects"); }
  async list(email: string, admin: boolean) { return (await this.col()).find(admin ? {} : { "members.email": email }).sort({ updatedAt: -1 }).toArray(); }
  async create(input: Pick<Project, "name" | "description" | "team">, owner: string) { const now = new Date().toISOString(); const project: Project = { _id: randomUUID(), ...input, members: [{ email: owner, role: "owner" }], createdAt: now, updatedAt: now }; await (await this.col()).insertOne(project); return project; }
  async get(id: string, email: string, admin: boolean) { return (await this.col()).findOne(admin ? { _id: id } : { _id: id, "members.email": email }); }
  async findById(id: string) { return (await this.col()).findOne({ _id: id }); }
  async memberRole(id: string, email: string) { return (await (await this.col()).findOne({ _id: id, "members.email": email }, { projection: { members: 1 } }))?.members.find((member) => member.email === email)?.role; }
  async update(id: string, input: Partial<Pick<Project, "name" | "description" | "team">>) { await (await this.col()).updateOne({ _id: id }, { $set: { ...input, updatedAt: new Date().toISOString() } }); return (await this.col()).findOne({ _id: id }); }
  async setMember(id: string, email: string, role: ProjectRole) { await (await this.col()).updateOne({ _id: id }, { $pull: { members: { email: email.toLowerCase() } } }); await (await this.col()).updateOne({ _id: id }, { $push: { members: { email: email.toLowerCase(), role } }, $set: { updatedAt: new Date().toISOString() } }); }
}

