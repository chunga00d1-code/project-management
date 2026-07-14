import { describe, expect, it, vi } from "vitest";
import { listRepositoryCollaborators } from "../src/modules/github-app/collaborator.service.js";

describe("GitHub repository collaborators", () => {
  it("paginates, normalizes, deduplicates, and sorts collaborators", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      login: `user-${String(index).padStart(3, "0")}`,
      avatar_url: `https://avatars.example/${index}`,
    }));
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { login: "USER-001", avatar_url: "https://avatars.example/duplicate" },
        { login: "alice", avatar_url: "https://avatars.example/alice" },
      ]), { status: 200 }));

    const result = await listRepositoryCollaborators("acme/widgets", 42, {
      fetcher: fetcher as typeof fetch,
      token: "installation-token",
      bypassCache: true,
    });

    expect(result[0]).toEqual({ login: "alice", avatarUrl: "https://avatars.example/alice" });
    expect(result.filter((item) => item.login.toLowerCase() === "user-001")).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("maps GitHub failures to a safe typed error", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    await expect(listRepositoryCollaborators("acme/widgets", 42, {
      fetcher: fetcher as typeof fetch,
      token: "installation-token",
      bypassCache: true,
    })).rejects.toMatchObject({ status: 403, name: "GitHubCollaboratorError" });
  });
});
