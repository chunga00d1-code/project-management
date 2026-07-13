import { database } from "../../core/database.js";
export type DeliveryState = "processing" | "completed";
export class DeliveryService {
  private async col() { return (await database()).collection<{ _id: string; state: DeliveryState; expiresAt: Date }>("github_webhook_deliveries"); }
  async seen(id: string) { return Boolean(await (await this.col()).findOne({ _id: id })); }
  async mark(id: string, state: DeliveryState = "completed") { await (await this.col()).updateOne({ _id: id }, { $set: { state, expiresAt: new Date(Date.now() + 3600000) } }, { upsert: true }); }
}
