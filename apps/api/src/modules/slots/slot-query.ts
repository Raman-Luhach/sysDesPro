import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { SlotRepository } from './slot.repository';
import type { FeedFilter, SlotRecord } from './slot.types';

/** Read-side port for the public deal feed. */
export abstract class SlotFeedQuery {
  abstract listOnSale(filter: FeedFilter): Promise<SlotRecord[]>;
}

@Injectable()
export class DbSlotFeedQuery extends SlotFeedQuery {
  constructor(private readonly repo: SlotRepository) {
    super();
  }

  listOnSale(filter: FeedFilter): Promise<SlotRecord[]> {
    return this.repo.listOnSale(filter, new Date());
  }
}

const VERSION_KEY = 'flashslot:feed:version';
const TTL_MS = 30_000;
const DATE_FIELDS = new Set(['startsAt', 'liveAt', 'holdExpiresAt', 'soldAt', 'createdAt', 'updatedAt']);
const reviveDates = (k: string, v: unknown) => (DATE_FIELDS.has(k) && typeof v === 'string' ? new Date(v) : v);

/**
 * DECORATOR pattern + CACHE-ASIDE: wraps any SlotFeedQuery with a Redis cache.
 * Only the slow-changing slot data is cached; prices are computed fresh on every read.
 * Invalidation is by version bump: any slot change increments the version so all
 * cached feeds become unreachable at once (no need to find and delete keys).
 */
export class CachedSlotFeedQuery extends SlotFeedQuery {
  constructor(
    private readonly inner: SlotFeedQuery,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async listOnSale(filter: FeedFilter): Promise<SlotRecord[]> {
    let key: string;
    try {
      const version = (await this.redis.client.get(VERSION_KEY)) ?? '0';
      key = `flashslot:feed:v${version}:${filter.category ?? '*'}:${(filter.city ?? '*').toLowerCase()}`;
      const cached = await this.redis.getJson<SlotRecord[]>(key, reviveDates);
      if (cached) return cached;
    } catch {
      // Cache unavailable: serve straight from the database (slower, still correct).
      return this.inner.listOnSale(filter);
    }
    const fresh = await this.inner.listOnSale(filter);
    await this.redis.setJson(key, fresh, TTL_MS).catch(() => undefined);
    return fresh;
  }
}

@Injectable()
export class SlotCacheInvalidator {
  constructor(private readonly redis: RedisService) {}

  async invalidate(): Promise<void> {
    await this.redis.client.incr(VERSION_KEY).catch(() => 0);
  }
}
