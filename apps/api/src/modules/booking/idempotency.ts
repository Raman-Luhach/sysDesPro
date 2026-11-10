import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis/redis.service';

const IN_FLIGHT_TTL_MS = 30_000;

/**
 * Guards against the SAME request running twice at the same time (double-click, client
 * retry on a flaky network). Completed requests are deduplicated by the UNIQUE
 * idempotencyKey column on Booking; this lock covers the window while one is in flight.
 */
@Injectable()
export class IdempotencyLock {
  constructor(private readonly redis: RedisService) {}

  async begin(scopedKey: string): Promise<boolean> {
    try {
      return (await this.redis.client.set(this.key(scopedKey), '1', 'PX', IN_FLIGHT_TTL_MS, 'NX')) === 'OK';
    } catch {
      return true; // Redis down: rely on the UNIQUE idempotencyKey column instead.
    }
  }

  async end(scopedKey: string): Promise<void> {
    await this.redis.client.del(this.key(scopedKey)).catch(() => 0);
  }

  private key(k: string): string {
    return `flashslot:idem:${k}`;
  }
}
