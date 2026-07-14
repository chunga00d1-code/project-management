import { getInstallationToken } from "./github-app.service.js";

export interface GitHubCollaborator {
  login: string;
  name?: string;
  avatarUrl: string;
}

export class GitHubCollaboratorError extends Error {
  constructor(public readonly status: number) {
    super("Unable to load repository collaborators from GitHub");
    this.name = "GitHubCollaboratorError";
  }
}

type CollaboratorOptions = {
  fetcher?: typeof fetch;
  token?: string;
  bypassCache?: boolean;
};

const cache = new Map<string, { expiresAt: number; items: GitHubCollaborator[] }>();

export async function listRepositoryCollaborators(
  repositoryFullName: string,
  installationId: number,
  options: CollaboratorOptions = {},
): Promise<GitHubCollaborator[]> {
  const cacheKey = repositoryFullName.toLowerCase();
  const cached = cache.get(cacheKey);
  if (!options.bypassCache && cached && cached.expiresAt > Date.now()) return cached.items;

  const token = options.token || await getInstallationToken(installationId);
  const fetcher = options.fetcher || fetch;
  const raw: { login: string; avatar_url: string }[] = [];

  for (let page = 1; ; page += 1) {
    const response = await fetcher(
      `https://api.github.com/repos/${repositoryFullName}/collaborators?per_page=100&page=${page}`,
      { headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" } },
    );
    if (!response.ok) throw new GitHubCollaboratorError(response.status);
    const batch = await response.json() as typeof raw;
    raw.push(...batch);
    if (batch.length < 100) break;
  }

  const items = [...new Map(raw.map((item) => [
    item.login.toLowerCase(),
    { login: item.login, avatarUrl: item.avatar_url },
  ])).values()].sort((left, right) => left.login.localeCompare(right.login));

  cache.set(cacheKey, { expiresAt: Date.now() + 300_000, items });
  return items;
}

export async function isRepositoryCollaborator(
  repositoryFullName: string,
  installationId: number,
  login: string,
): Promise<boolean> {
  const collaborators = await listRepositoryCollaborators(repositoryFullName, installationId);
  return collaborators.some((item) => item.login.toLowerCase() === login.toLowerCase());
}
