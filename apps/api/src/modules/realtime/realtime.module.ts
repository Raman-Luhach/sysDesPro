import { Global, Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimePublisher, SocketIoRealtimePublisher, SocketServerRef } from './realtime.publisher';
import { ViewerPresenceService } from './viewer-presence.service';

@Global()
@Module({
  providers: [
    SocketServerRef,
    { provide: RealtimePublisher, useClass: SocketIoRealtimePublisher },
    ViewerPresenceService,
    RealtimeGateway,
  ],
  exports: [RealtimePublisher, ViewerPresenceService],
})
export class RealtimeModule {}
