import { createHash, randomBytes, randomUUID } from "crypto";
import { database } from "../../core/database.js";
export interface SessionModel { _id: string; userId: string; tokenHash: string; expiresAt: Date; createdAt: Date; lastUsedAt: Date; }
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export class SessionService {
  private async col() { return (await database()).collection<SessionModel>("auth_sessions"); }
  async create(userId: string) { const token = randomBytes(48).toString("base64url"); const now = new Date(); await (await this.col()).insertOne({ _id: randomUUID(), userId, tokenHash: hash(token), createdAt: now, lastUsedAt: now, expiresAt: new Date(now.getTime() + 30 * 86400000) }); return token; }
  async rotate(token: string) { const col = await this.col(); const session = await col.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } }); if (!session) return null; await col.deleteOne({ _id: session._id }); return { userId: session.userId, token: await this.create(session.userId) }; }
  async revoke(token: string) { await (await this.col()).deleteOne({ tokenHash: hash(token) }); }
  async revokeUser(userId: string) { await (await this.col()).deleteMany({ userId }); }
}
