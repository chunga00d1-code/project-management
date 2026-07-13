import { createClient } from "redis";
import { env } from "../config/env.js";
import { logger } from "./logger.js";
const redis = env.redisHost
  ? createClient({
      socket: {
        host: env.redisHost,
        port: env.redisPort,
      },
      password: env.redisPassword || undefined,
    })
  : undefined;
const memory = new Map<string, { count: number; expiresAt: number }>();
if (redis) redis.on("error", (error) => logger.error("redis_error", { error }));
export async function connectRateLimiter() { if (!redis || redis.isOpen) return; try { await redis.connect(); logger.info("redis_connected"); } catch (error) { logger.warn("redis_connect_failed_using_memory_rate_limit", { error }); } }
export async function closeRateLimiter() { if (redis?.isOpen) await redis.close(); }
export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) { if (redis?.isReady) { const namespaced = `rate:${key}`; const count = await redis.incr(namespaced); if (count === 1) await redis.expire(namespaced, windowSeconds); return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfter: await redis.ttl(namespaced) }; } const now = Date.now(); const current = memory.get(key); const state = !current || current.expiresAt <= now ? { count: 0, expiresAt: now + windowSeconds * 1000 } : current; state.count += 1; memory.set(key, state); if (memory.size > 10000) for (const [itemKey, item] of memory) if (item.expiresAt <= now) memory.delete(itemKey); return { allowed: state.count <= limit, remaining: Math.max(0, limit - state.count), retryAfter: Math.max(1, Math.ceil((state.expiresAt - now) / 1000)) }; }
