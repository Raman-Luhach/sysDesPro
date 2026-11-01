import { Injectable } from '@nestjs/common';
import { LuaScript } from '../redis/lua-script';
import { RedisService } from '../redis/redis.service';

export interface RateLimitPolicy {
  /** Maximum burst size. */
  capacity: number;
  /** Tokens refilled per second. */
  refillPerSec: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Token bucket in Redis: each key has `tokens` that refill continuously up to `capacity`.
 * A request spends one token; no token -> rejected. Runs as one Lua script so concurrent
 * requests on different API instances share one consistent bucket. Uses Redis TIME so
 * instance clock skew does not matter.
 */
const TOKEN_BUCKET = new LuaScript<[number, number, number]>(`
local capacity = tonumber(ARGV[1])
local refillPerMs = tonumber(ARGV[2]) / 1000
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(data[1]) or capacity
local ts = tonumber(data[2]) or now
tokens = math.min(capacity, tokens + (now - ts) * refillPerMs)
local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end
redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'ts', now)
redis.call('PEXPIRE', KEYS[1], math.ceil(capacity / refillPerMs) + 1000)
local retry = 0
if allowed == 0 then retry = math.ceil((1 - tokens) / refillPerMs) end
return {allowed, math.floor(tokens), retry}
`);

@Injectable()
export class TokenBucketLimiter {
  constructor(private readonly redis: RedisService) {}

  async consume(key: string, policy: RateLimitPolicy): Promise<RateLimitDecision> {
    const [allowed, remaining, retryAfterMs] = await TOKEN_BUCKET.run(
      this.redis.client,
      [`rl:${key}`],
      [policy.capacity, policy.refillPerSec],
    );
    return { allowed: allowed === 1, remaining, retryAfterMs };
  }
}
