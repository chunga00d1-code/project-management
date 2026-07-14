import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeDoc {
  _id: string;
  repositoryFullName?: string;
  installationId?: number;
  [key: string]: unknown;
}

const store: FakeDoc[] = [];

vi.mock("../src/core/database.js", () => ({
  database: async () => ({
    collection: () => ({
      findOne: async (query: Partial<FakeDoc>) =>
        store.find((doc) => Object.entries(query).every(([key, value]) => doc[key] === value)) || null,
      insertOne: async (doc: FakeDoc) => {
        store.push(doc);
      },
      updateOne: async (
        query: Partial<FakeDoc>,
        update: { $set?: Partial<FakeDoc> },
      ) => {
        const doc = store.find((d) => Object.entries(query).every(([key, value]) => d[key] === value));
        if (doc && update.$set) Object.assign(doc, update.$set);
      },
      updateMany: async (
        query: Partial<FakeDoc>,
        update: { $set?: Partial<FakeDoc>; $unset?: Record<string, string> },
      ) => {
        for (const doc of store.filter((d) => Object.entries(query).every(([key, value]) => d[key] === value))) {
          if (update.$unset) for (const key of Object.keys(update.$unset)) delete doc[key];
          if (update.$set) Object.assign(doc, update.$set);
        }
      },
    }),
  }),
}));

const { ProjectLinkService } = await import("../src/modules/github-app/project-link.service.js");

describe("ProjectLinkService", () => {
  beforeEach(() => {
    store.length = 0;
  });

  it("creates a new project when repository is not yet linked", async () => {
    const service = new ProjectLinkService();
    await service.linkRepositoryToProject("acme/widgets", 42);
    expect(store).toHaveLength(1);
    expect(store[0]).toMatchObject({ name: "widgets", repositoryFullName: "acme/widgets", installationId: 42 });
  });

  it("updates installationId when repository is already linked", async () => {
    const service = new ProjectLinkService();
    await service.linkRepositoryToProject("acme/widgets", 42);
    await service.linkRepositoryToProject("acme/widgets", 99);
    expect(store).toHaveLength(1);
    expect(store[0].installationId).toBe(99);
  });

  it("unlinks a repository without deleting the project", async () => {
    const service = new ProjectLinkService();
    await service.linkRepositoryToProject("acme/widgets", 42);
    await service.unlinkRepository("acme/widgets");
    expect(store).toHaveLength(1);
    expect(store[0].repositoryFullName).toBeUndefined();
    expect(store[0].installationId).toBeUndefined();
  });
});
