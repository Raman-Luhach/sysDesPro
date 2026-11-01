import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { appConfig } from '../../common/config/app-config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor() {
    // Fail fast: while Redis is disconnected, commands error immediately (no offline queue)
    // so callers fall back (DB-only lock, uncached feed) instead of hanging the request.
    this.client = new Redis(appConfig.redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 3000, enableOfflineQueue: false });
    this.client.on('error', (e) => this.logger.error(`Redis error: ${e.message}`));
  }

  /** A second connection (pub/sub needs dedicated connections). */
  duplicate(): Redis {
    // Pub/sub connections keep the offline queue so subscriptions survive reconnects.
    return this.client.duplicate({ enableOfflineQueue: true, maxRetriesPerRequest: null });
  }

  /** Wait (briefly) for the connection so startup hooks don't race it. */
  async onModuleInit(): Promise<void> {
    if (this.client.status === 'ready') return;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      this.client.once('ready', done);
      setTimeout(done, 3000);
    });
  }

  async getJson<T>(key: string, reviver?: (k: string, v: unknown) => unknown): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw, reviver) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlMs: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'PX', ttlMs);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }
}
