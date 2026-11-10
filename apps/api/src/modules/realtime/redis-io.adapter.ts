import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { ServerOptions } from 'socket.io';
import { RedisService } from '../../infrastructure/redis/redis.service';

/**
 * Socket.IO + Redis pub/sub adapter = horizontally scalable WebSockets.
 * Each API instance publishes emits to Redis; every instance relays them to its own sockets.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterFactory?: ReturnType<typeof createAdapter>;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  connect(): void {
    const redis = this.app.get(RedisService);
    this.adapterFactory = createAdapter(redis.duplicate(), redis.duplicate());
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, { ...options, transports: ['websocket', 'polling'] });
    if (this.adapterFactory) server.adapter(this.adapterFactory);
    return server;
  }
}
