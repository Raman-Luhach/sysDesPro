import { createHash } from 'node:crypto';
import type Redis from 'ioredis';

/**
 * A Redis Lua script. Redis runs a script atomically (single-threaded, nothing interleaves),
 * which is what lets us implement "check-then-set" without race conditions.
 * Uses EVALSHA (script cached on the server) and falls back to EVAL on first use.
 */
export class LuaScript<TResult = unknown> {
  private readonly sha: string;

  constructor(private readonly source: string) {
    this.sha = createHash('sha1').update(source).digest('hex');
  }

  async run(redis: Redis, keys: string[], args: Array<string | number>): Promise<TResult> {
    try {
      return (await redis.evalsha(this.sha, keys.length, ...keys, ...args)) as TResult;
    } catch (e) {
      if (e instanceof Error && e.message.includes('NOSCRIPT')) {
        return (await redis.eval(this.source, keys.length, ...keys, ...args)) as TResult;
      }
      throw e;
    }
  }
}
