import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { TokenVerifier } from '../auth/guards';
import { SocketServerRef } from './realtime.publisher';
import { ViewerPresenceService } from './viewer-presence.service';

interface SocketData {
  userId?: string;
  watching: Set<string>;
}

const MAX_WATCHED = 5;

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly ref: SocketServerRef,
    private readonly tokens: TokenVerifier,
    private readonly presence: ViewerPresenceService,
  ) {}

  afterInit(server: Server): void {
    this.ref.server = server;
    this.logger.log('Realtime gateway ready');
  }

  async handleConnection(socket: Socket): Promise<void> {
    const data = socket.data as SocketData;
    data.watching = new Set();
    const user = await this.tokens.verify(socket.handshake.auth?.token as string | undefined);
    if (user) {
      data.userId = user.id;
      await socket.join(`user:${user.id}`);
    }
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const data = socket.data as SocketData;
    for (const slotId of data.watching ?? []) await this.presence.leave(slotId);
  }

  @SubscribeMessage('slot:watch')
  async watch(@ConnectedSocket() socket: Socket, @MessageBody() body: { slotId?: string }): Promise<void> {
    const data = socket.data as SocketData;
    const slotId = body?.slotId;
    if (typeof slotId !== 'string' || data.watching.has(slotId) || data.watching.size >= MAX_WATCHED) return;
    data.watching.add(slotId);
    await this.presence.join(slotId);
  }

  @SubscribeMessage('slot:unwatch')
  async unwatch(@ConnectedSocket() socket: Socket, @MessageBody() body: { slotId?: string }): Promise<void> {
    const data = socket.data as SocketData;
    const slotId = body?.slotId;
    if (typeof slotId !== 'string' || !data.watching.delete(slotId)) return;
    await this.presence.leave(slotId);
  }
}
