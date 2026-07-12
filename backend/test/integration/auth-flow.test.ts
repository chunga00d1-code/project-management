import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

let mongod: MongoMemoryServer;
let app: import("express").Express;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.SUPERADMIN_EMAIL = "admin@example.com";
  process.env.SUPERADMIN_PASSWORD = "password123";
  process.env.GITHUB_WEBHOOK_SECRET = "test-webhook-secret";
  const { buildApp } = await import("../../src/app.js");
  app = await buildApp();
}, 120_000);

afterAll(async () => {
  const { closeDatabase } = await import("../../src/core/database.js");
  await closeDatabase();
  await mongod.stop();
});

describe("auth flow (integration)", () => {
  it("rejects unauthenticated access to a protected route", async () => {
    await request(app).get("/api/auth/me").expect(401);
  });

  it("rejects login with wrong credentials", async () => {
    await request(app).post("/api/auth/login").send({ email: "admin@example.com", password: "wrong" }).expect(401);
  });

  it("logs in with the bootstrapped superadmin and sets an httpOnly cookie", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "admin@example.com", password: "password123" }).expect(200);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/token=.*HttpOnly/i);
    expect(res.body.user.email).toBe("admin@example.com");
    expect(res.body.token).toBeUndefined();
  });

  it("allows access to a protected route using the session cookie", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "admin@example.com", password: "password123" }).expect(200);
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.role).toBe("superadmin");
  });

  it("revokes the session on logout so the old cookie stops working", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "admin@example.com", password: "password123" }).expect(200);
    await agent.get("/api/auth/me").expect(200);
    await agent.post("/api/auth/logout").expect(204);
    await agent.get("/api/auth/me").expect(401);
  });

  it("blocks a cross-origin state-changing request", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "admin@example.com", password: "password123" }).expect(200);
    await agent.post("/api/tasks").set("Origin", "https://evil.example.com").send({ title: "x" }).expect(403);
  });
});

describe("task API validation (integration)", () => {
  it("rejects task creation with an invalid body", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "admin@example.com", password: "password123" }).expect(200);
    await agent.post("/api/tasks").send({}).expect(400);
  });

  it("strips unknown/dangerous fields on task creation", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "admin@example.com", password: "password123" }).expect(200);
    const res = await agent.post("/api/tasks").send({ title: "Task A", _id: "attacker-id", activities: [{ id: "1", message: "forged", at: "now" }] }).expect(201);
    expect(res.body._id).not.toBe("attacker-id");
    expect(res.body.activities).toHaveLength(1);
    expect(res.body.activities[0].message).toBe("Task created");
  });
});
