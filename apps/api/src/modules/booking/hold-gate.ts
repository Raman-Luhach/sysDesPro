import { Injectable, Logger } from '@nestjs/common';
import { LuaScript } from '../../infrastructure/redis/lua-script';
import { RedisService } from '../../infrastructure/redis/redis.service';

export type GateResult = 'ACQUIRED' | 'ALREADY_MINE' | 'TAKEN' | 'UNAVAILABLE';

/**
 * Atomic "first one wins" in Redis. Only one caller can create the key; the script runs
 * as a single indivisible step, so there is no gap between "check" and "set".
 * Returns 1 = acquired, 2 = caller already holds it, 0 = someone else holds it.
 */
const ACQUIRE = new LuaScript<number>(`
local holder = redis.call('GET', KEYS[1])
if not holder then
  redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
  return 1
end
if holder == ARGV[1] then return 2 end
return 0
`);

/** Delete only if we own it (never release someone else's hold). */
const RELEASE = new LuaScript<number>(`
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`);

/**
 * LAYER 1 of the exactly-once guarantee: a fast distributed lock in Redis.
 * Under a stampede of 1,000 buyers, 999 are rejected here in ~1ms without touching
 * Postgres, which protects the database. Correctness does NOT depend on this layer:
 * the conditional UPDATE in SlotRepository (layer 2) and the UNIQUE(slotId) constraint
 * on Booking (layer 3) still guarantee one sale even if Redis is wrong or down.
 */
@Injectable()
export class HoldGate {
  private readonly logger = new Logger(HoldGate.name);

  constructor(private readonly redis: RedisService) {}

  async tryAcquire(slotId: string, userId: string, ttlMs: number): Promise<GateResult> {
    try {
      const r = await ACQUIRE.run(this.redis.client, [this.key(slotId)], [userId, ttlMs]);
      return r === 1 ? 'ACQUIRED' : r === 2 ? 'ALREADY_MINE' : 'TAKEN';
    } catch (e) {
      // GRACEFUL DEGRADATION: Redis is down. Let the request through; the Postgres
      // optimistic lock (layer 2) still guarantees a single winner, just with more DB load.
      this.logger.warn(`Hold gate unavailable, falling back to DB lock only: ${(e as Error).message}`);
      return 'UNAVAILABLE';
    }
  }

  async release(slotId: string, userId: string): Promise<void> {
    await RELEASE.run(this.redis.client, [this.key(slotId)], [userId]).catch(() => 0);
  }

  private key(slotId: string): string {
    return `flashslot:hold:${slotId}`;
  }
}
