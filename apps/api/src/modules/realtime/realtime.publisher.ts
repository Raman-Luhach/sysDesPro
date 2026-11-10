import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/**
 * Port for pushing events to connected clients. Business services depend on this
 * abstraction, never on Socket.IO directly (Dependency Inversion).
 */
export abstract class RealtimePublisher {
  abstract toAll(event: string, data: unknown): void;
  abstract toUser(userId: string, event: string, data: unknown): void;
  abstract toRoom(room: string, event: string, data: unknown): void;
}

/** Holds the Socket.IO server once the gateway has initialised (breaks a DI cycle). */
@Injectable()
export class SocketServerRef {
  server?: Server;
}

/**
 * Socket.IO adapter. Because the server uses the Redis adapter, an emit on one API
 * instance reaches clients connected to ANY instance.
 */
@Injectable()
export class SocketIoRealtimePublisher extends RealtimePublisher {
  constructor(private readonly ref: SocketServerRef) {
    super();
  }

  toAll(event: string, data: unknown): void {
    this.ref.server?.emit(event, data);
  }

  toUser(userId: string, event: string, data: unknown): void {
    this.ref.server?.to(`user:${userId}`).emit(event, data);
  }

  toRoom(room: string, event: string, data: unknown): void {
    this.ref.server?.to(room).emit(event, data);
  }
}
