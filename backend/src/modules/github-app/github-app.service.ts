import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

const tokenCache = new Map<number, { token: string; expiresAt: number }>();

export function createAppJwt(): string {
  if (!env.githubAppId || !env.githubAppPrivateKey)
    throw new Error("GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY not configured");
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iat: now - 60, exp: now + 600, iss: env.githubAppId },
    env.githubAppPrivateKey,
    { algorithm: "RS256" },
  );
}

export async function getInstallationToken(installationId: number): Promise<string> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt > Date.now() + 30000) return cached.token;
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${createAppJwt()}`,
        accept: "application/vnd.github+json",
      },
    },
  );
  if (!response.ok)
    throw new Error(`GitHub installation token HTTP ${response.status}`);
  const data = (await response.json()) as { token: string; expires_at: string };
  const expiresAt = new Date(data.expires_at).getTime();
  tokenCache.set(installationId, { token: data.token, expiresAt });
  return data.token;
}

export async function listInstallationRepositories(
  installationId: number,
): Promise<string[]> {
  const token = await getInstallationToken(installationId);
  const repositories: string[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(
      `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
        },
      },
    );
    if (!response.ok)
      throw new Error(`GitHub installation repositories HTTP ${response.status}`);
    const batch = (await response.json()) as {
      repositories: { full_name: string }[];
    };
    repositories.push(...batch.repositories.map((repo) => repo.full_name));
    if (batch.repositories.length < 100) break;
  }
  return repositories;
}
