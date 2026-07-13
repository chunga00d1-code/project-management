import { randomUUID } from "crypto";
import { database } from "./database.js";

export async function audit(input: { actor?: string; action: string; target: string; metadata?: Record<string, unknown> }) {
  await (await database()).collection<{ _id: string; actor?: string; action: string; target: string; metadata?: Record<string, unknown>; at: string }>("audit_logs").insertOne({ _id: randomUUID(), ...input, at: new Date().toISOString() });
}

