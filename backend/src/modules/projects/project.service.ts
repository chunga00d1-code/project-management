import { database } from "../../core/database.js";

export type ProjectRole = "owner" | "manager" | "member" | "viewer";
export interface Project {
  _id: string;
  name: string;
  description: string;
  team?: string;
  members: { email: string; role: ProjectRole }[];
  createdAt: string;
  updatedAt: string;
  repositoryFullName?: string;
  installationId?: number;
}

export class ProjectService {
  private async col() {
    return (await database()).collection<Project>("projects");
  }

  async list(_email: string, _admin: boolean) {
    return (await this.col()).find({ repositoryFullName: { $exists: true } }).sort({ updatedAt: -1 }).toArray();
  }

  async get(id: string, _email: string, _admin: boolean) {
    return (await this.col()).findOne({ _id: id, repositoryFullName: { $exists: true } });
  }

  async findById(id: string) {
    return (await this.col()).findOne({ _id: id, repositoryFullName: { $exists: true } });
  }
}
