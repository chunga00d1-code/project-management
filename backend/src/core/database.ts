import { MongoClient, Db, MongoClientOptions } from "mongodb";
import { env } from "../config/env.js";
let client: MongoClient;
export async function database(): Promise<Db> {
  if (!client) {
    const options: MongoClientOptions = env.mongoUser
      ? {
          auth: { username: env.mongoUser, password: env.mongoPassword },
          authSource: env.mongoAuthSource,
        }
      : {};
    client = new MongoClient(env.mongoUri, options);
    await client.connect();
  }
  return client.db();
}
export async function closeDatabase() {
  await client?.close();
}
