import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { LeaderElectionService } from '../../infrastructure/coordination/leader-election.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { DomainEvent } from './domain-events';
import { EventBus } from './event-bus';

const MAX_ATTEMPTS = 5;
const BATCH = 50;

/**
 * TRANSACTIONAL OUTBOX (writer side).
 * The event row is inserted in the SAME transaction as the business change, so either both
 * are saved or neither. No "slot sold but notification lost" if the process crashes.
 */
@Injectable()
export class OutboxWriter {
  async add(tx: Prisma.TransactionClient, event: DomainEvent): Promise<void> {
    await tx.outboxEvent.create({ data: { type: event.type, payload: event.payload as Prisma.InputJsonValue } });
  }

  async addMany(tx: Prisma.TransactionClient, events: DomainEvent[]): Promise<void> {
    if (!events.length) return;
    await tx.outboxEvent.createMany({
      data: events.map((e) => ({ type: e.type, payload: e.payload as Prisma.InputJsonValue })),
    });
  }
}

/**
 * Outbox relay: polls unprocessed events and publishes them on the EventBus.
 * Runs only on the leader instance. At-least-once delivery with bounded retries.
 */
@Injectable()
export class OutboxRelay {
  private readonly logger = new Logger(OutboxRelay.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly leader: LeaderElectionService,
  ) {}

  @Interval(1000)
  async drain(): Promise<void> {
    if (!this.leader.isLeader || this.running) return;
    this.running = true;
    try {
      const events = await this.prisma.outboxEvent.findMany({
        where: { processedAt: null, attempts: { lt: MAX_ATTEMPTS } },
        orderBy: { createdAt: 'asc' },
        take: BATCH,
      });
      for (const row of events) {
        try {
          await this.bus.publish({ type: row.type, payload: row.payload } as DomainEvent);
          await this.prisma.outboxEvent.update({ where: { id: row.id }, data: { processedAt: new Date() } });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          this.logger.warn(`Outbox event ${row.id} failed: ${message}`);
          await this.prisma.outboxEvent.update({
            where: { id: row.id },
            data: { attempts: { increment: 1 }, lastError: message.slice(0, 500) },
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}
