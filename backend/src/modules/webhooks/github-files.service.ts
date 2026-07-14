import { env } from "../../config/env.js";
export interface PullFile {
  filename: string;
  patch?: string;
}
export async function getPullRequestFiles(
  repositoryApiUrl: string,
  number: number,
  maxPages = 10,
  token: string = env.githubApiToken,
): Promise<PullFile[]> {
  const files: PullFile[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetch(
      `${repositoryApiUrl}/pulls/${number}/files?per_page=100&page=${page}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
        },
      },
    );
    if (!response.ok) throw new Error(`GitHub files HTTP ${response.status}`);
    const batch = (await response.json()) as PullFile[];
    files.push(...batch);
    if (batch.length < 100) break;
  }
  return files;
}
