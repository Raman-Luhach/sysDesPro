import { Global, Module } from '@nestjs/common';
import { EventBus } from './event-bus';
import { OutboxRelay, OutboxWriter } from './outbox';

@Global()
@Module({
  providers: [EventBus, OutboxWriter, OutboxRelay],
  exports: [EventBus, OutboxWriter],
})
export class EventsModule {}
