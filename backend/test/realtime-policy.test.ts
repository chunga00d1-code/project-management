import { describe, expect, it } from "vitest";
import { canReceiveRealtimeEvent } from "../src/modules/realtime/realtime.policy.js";
import type { RealtimeEvent } from "../src/modules/realtime/realtime.service.js";
const event = (input: Partial<RealtimeEvent>): RealtimeEvent => ({ _id: "event", type: "task.updated", entityId: "task", occurredAt: new Date().toISOString(), version: 1, expiresAt: new Date(), ...input });
describe("realtime event policy", () => {
  it("allows project members and blocks unrelated projects", () => { const context = { isAdmin: false, userId: "u1", projectIds: new Set(["p1"]) }; expect(canReceiveRealtimeEvent(event({ projectId: "p1" }), context)).toBe(true); expect(canReceiveRealtimeEvent(event({ projectId: "p2" }), context)).toBe(false); });
  it("allows user-scoped events and admin global visibility", () => { expect(canReceiveRealtimeEvent(event({ userId: "u1" }), { isAdmin: false, userId: "u1", projectIds: new Set() })).toBe(true); expect(canReceiveRealtimeEvent(event({}), { isAdmin: true, userId: "admin", projectIds: new Set() })).toBe(true); });
});
