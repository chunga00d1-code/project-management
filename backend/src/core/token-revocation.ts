import { database } from "./database.js";
interface RevokedToken { _id: string; expiresAt: Date }
let indexEnsured = false;
async function col() {
  const collection = (await database()).collection<RevokedToken>("revoked_tokens");
  if (!indexEnsured) { await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); indexEnsured = true; }
  return collection;
}
export async function revokeToken(jti: string, expiresAt: Date) {
  await (await col()).updateOne({ _id: jti }, { $set: { expiresAt } }, { upsert: true });
}
export async function isTokenRevoked(jti: string): Promise<boolean> {
  return Boolean(await (await col()).findOne({ _id: jti }));
}
