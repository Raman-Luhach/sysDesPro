import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { appConfig } from '../../common/config/app-config';
import { LeaderElectionService } from '../../infrastructure/coordination/leader-election.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OutboxWriter } from '../events/outbox';
import { PricingService } from '../pricing/pricing.service';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { SlotChangePublisher } from './slot-change.publisher';
import { SlotFeedQuery } from './slot-query';
import { SlotRepository } from './slot.repository';

/**
 * Pushes the current price of every on-sale slot to all clients every 2s.
 * Leader-only, so with N API instances clients still get ONE tick, not N.
 */
@Injectable()
export class PriceTicker {
  constructor(
    private readonly leader: LeaderElectionService,
    private readonly feedQuery: SlotFeedQuery,
    private readonly pricing: PricingService,
    private readonly realtime: RealtimePublisher,
  ) {}

  @Interval(appConfig.priceTickMs)
  async tick(): Promise<void> {
    if (!this.leader.isLeader) return;
    const now = new Date();
    const slots = await this.feedQuery.listOnSale({});
    const prices = Object.fromEntries(slots.map((s) => [s.id, this.pricing.priceAt(s, now)]));
    this.realtime.toAll('prices', { at: now.toISOString(), prices });
  }
}

/**
 * Lifecycle sweeper (leader-only): writes the time-based transitions to the database.
 * Reads already treat expired holds as LIVE (lazy expiry); this makes it permanent and
 * tells clients the slot is back.
 */
@Injectable()
export class SlotLifecycleSweeper {
  private readonly logger = new Logger(SlotLifecycleSweeper.name);
  private running = false;

  constructor(
    private readonly leader: LeaderElectionService,
    private readonly repo: SlotRepository,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxWriter,
    private readonly changes: SlotChangePublisher,
  ) {}

  @Interval(3000)
  async sweep(): Promise<void> {
    if (!this.leader.isLeader || this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const reverted = await this.repo.revertExpiredHolds(now);
      if (reverted.length) this.logger.log(`Released ${reverted.length} expired hold(s)`);

      const expired = await this.repo.expireStarted(now);
      const toNotify = expired.filter((s) => !s.isDemo);
      if (toNotify.length) {
        await this.prisma.$transaction((tx) =>
          this.outbox.addMany(
            tx,
            toNotify.map((s) => ({ type: 'SLOT_EXPIRED' as const, payload: { slotId: s.id, title: s.title, merchantUserId: s.ownerId } })),
          ),
        );
      }
      await this.changes.slotsChanged([...reverted, ...expired.map((s) => s.id)]);
    } catch (e) {
      this.logger.error(`Sweep failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.running = false;
    }
  }
}
