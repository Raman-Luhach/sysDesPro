import { Injectable, Logger } from '@nestjs/common';
import type { DomainEvent, DomainEventType, EventOf } from './domain-events';

type Handler<T extends DomainEventType> = (event: EventOf<T>) => Promise<void> | void;

/**
 * OBSERVER pattern: in-process publish/subscribe for domain events.
 * New reactions (email, analytics, loyalty points) subscribe here without touching the
 * booking code that produces the event (Open/Closed).
 */
@Injectable()
export class EventBus {
  private readonly logger = new Logger(EventBus.name);
  private readonly handlers = new Map<DomainEventType, Array<Handler<DomainEventType>>>();

  subscribe<T extends DomainEventType>(type: T, handler: Handler<T>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as unknown as Handler<DomainEventType>);
    this.handlers.set(type, list);
  }

  /** Runs every handler; throws if any failed so the outbox can retry the event. */
  async publish(event: DomainEvent): Promise<void> {
    const results = await Promise.allSettled((this.handlers.get(event.type) ?? []).map((h) => h(event as never)));
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed.length) {
      this.logger.warn(`${failed.length} handler(s) failed for ${event.type}`);
      throw failed[0].reason;
    }
  }
}
