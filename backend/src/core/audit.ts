import { randomUUID } from "crypto";
import { database } from "./database.js";
export interface AuditLogEntry { _id: string; actor: string; action: string; target: string; meta?: Record<string, unknown>; at: string }
export async function logAudit(actor: string, action: string, target: string, meta?: Record<string, unknown>) {
  const col = (await database()).collection<AuditLogEntry>("audit_logs");
  await col.insertOne({ _id: randomUUID(), actor, action, target, meta, at: new Date().toISOString() });
}
