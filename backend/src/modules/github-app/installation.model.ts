import { database } from "../../core/database.js";

export interface Installation {
  _id: number;
  account: string;
  repositories: string[];
  createdAt: string;
  updatedAt: string;
}

export class InstallationService {
  private async col() {
    return (await database()).collection<Installation>("github_installations");
  }
  async upsert(installationId: number, account: string, repositories: string[]) {
    const now = new Date().toISOString();
    await (await this.col()).updateOne(
      { _id: installationId },
      {
        $set: { account, repositories, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }
  async addRepositories(installationId: number, repositories: string[]) {
    await (await this.col()).updateOne(
      { _id: installationId },
      { $addToSet: { repositories: { $each: repositories } }, $set: { updatedAt: new Date().toISOString() } },
    );
  }
  async removeRepositories(installationId: number, repositories: string[]) {
    await (await this.col()).updateOne(
      { _id: installationId },
      { $pullAll: { repositories }, $set: { updatedAt: new Date().toISOString() } },
    );
  }
  async delete(installationId: number) {
    return (await this.col()).findOneAndDelete({ _id: installationId });
  }
  async findByRepository(repositoryFullName: string) {
    return (await this.col()).findOne({ repositories: repositoryFullName });
  }
}
