import { Injectable, Logger } from '@nestjs/common';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { ViewerPresenceService } from '../realtime/viewer-presence.service';
import { SlotCacheInvalidator } from './slot-query';
import { SlotRepository } from './slot.repository';
import { SlotViewMapper } from './slot-view.mapper';

/**
 * After any slot state change: invalidate the feed cache and push the new public view
 * to every connected client. One place, so no service can forget either step (SRP).
 */
@Injectable()
export class SlotChangePublisher {
  private readonly logger = new Logger(SlotChangePublisher.name);

  constructor(
    private readonly repo: SlotRepository,
    private readonly cache: SlotCacheInvalidator,
    private readonly mapper: SlotViewMapper,
    private readonly realtime: RealtimePublisher,
    private readonly presence: ViewerPresenceService,
  ) {}

  async slotsChanged(ids: string[]): Promise<void> {
    if (!ids.length) return;
    try {
      await this.cache.invalidate();
      const [slots, viewers] = await Promise.all([this.repo.findManyByIds(ids), this.presence.counts(ids)]);
      const now = new Date();
      for (const slot of slots) {
        this.realtime.toAll('slot:update', this.mapper.toView(slot, { now, viewers: viewers[slot.id] }));
      }
    } catch (e) {
      // Never fail a committed purchase because a broadcast failed; clients also poll.
      this.logger.warn(`Broadcast failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  slotChanged(id: string): Promise<void> {
    return this.slotsChanged([id]);
  }
}
