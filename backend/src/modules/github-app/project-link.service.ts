import { randomUUID } from "crypto";
import { database } from "../../core/database.js";
import type { Project } from "../projects/project.service.js";

export class ProjectLinkService {
  private async col() {
    return (await database()).collection<Project>("projects");
  }
  async linkRepositoryToProject(repositoryFullName: string, installationId: number) {
    const now = new Date().toISOString();
    const existing = await (await this.col()).findOne({ repositoryFullName });
    if (existing) {
      await (await this.col()).updateOne(
        { _id: existing._id },
        { $set: { installationId, updatedAt: now } },
      );
      return;
    }
    const name = repositoryFullName.split("/").pop() || repositoryFullName;
    const project: Project = {
      _id: randomUUID(),
      name,
      description: `Auto-linked from GitHub repository ${repositoryFullName}`,
      members: [],
      createdAt: now,
      updatedAt: now,
      repositoryFullName,
      installationId,
    };
    await (await this.col()).insertOne(project);
  }
  async unlinkRepository(repositoryFullName: string) {
    await (await this.col()).updateMany(
      { repositoryFullName },
      { $unset: { repositoryFullName: "", installationId: "" }, $set: { updatedAt: new Date().toISOString() } },
    );
  }
}
