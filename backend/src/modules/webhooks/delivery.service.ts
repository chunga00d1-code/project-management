import { database } from "../../core/database.js";
export class DeliveryService {
  private async col() {
    return (await database()).collection<{ _id: string; expiresAt: Date }>(
      "github_webhook_deliveries",
    );
  }
  async seen(id: string) {
    const col = await this.col();
    await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    return Boolean(await col.findOne({ _id: id }));
  }
  async mark(id: string) {
    await (
      await this.col()
    ).updateOne(
      { _id: id },
      { $set: { expiresAt: new Date(Date.now() + 3600000) } },
      { upsert: true },
    );
  }
}
