import { env } from "../../config/env.js";
import { InstallationService } from "./installation.model.js";
import { getInstallationToken } from "./github-app.service.js";

const installations = new InstallationService();

export async function resolveGithubToken(repositoryFullName: string): Promise<string> {
  const installation = await installations.findByRepository(repositoryFullName);
  if (installation) {
    try {
      return await getInstallationToken(installation._id);
    } catch {
      return env.githubApiToken;
    }
  }
  return env.githubApiToken;
}
