import { database } from "./database.js";

export async function nextTaskCode(): Promise<string> {
  const db = await database();
  const result = await db
    .collection<{ _id: string; seq: number }>("counters")
    .findOneAndUpdate(
      { _id: "task" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" },
    );
  return `TASK-${result?.seq}`;
}
