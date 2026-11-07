import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../common/errors/domain-errors';
import { CurvePoint, PricingService } from '../pricing/pricing.service';
import { ViewerPresenceService } from '../realtime/viewer-presence.service';
import { FeedQueryDto } from './slot.dto';
import { SlotFeedQuery } from './slot-query';
import { SlotRepository } from './slot.repository';
import type { SlotView } from './slot.types';
import { SlotViewMapper } from './slot-view.mapper';

/** Read-side use cases for buyers (CQRS-lite: reads are separate from writes). */
@Injectable()
export class SlotFeedService {
  constructor(
    private readonly feedQuery: SlotFeedQuery,
    private readonly repo: SlotRepository,
    private readonly mapper: SlotViewMapper,
    private readonly presence: ViewerPresenceService,
    private readonly pricing: PricingService,
  ) {}

  async feed(q: FeedQueryDto, viewerId?: string): Promise<SlotView[]> {
    const now = new Date();
    const slots = await this.feedQuery.listOnSale({ category: q.category, city: q.city?.trim() || undefined });
    const viewers = await this.presence.counts(slots.map((s) => s.id));
    const views = slots
      .map((s) => this.mapper.toView(s, { now, viewerId, viewers: viewers[s.id] }))
      .filter((v) => v.status === 'LIVE' || v.status === 'HELD');

    switch (q.sort) {
      case 'discount':
        return views.sort((a, b) => b.discountPct - a.discountPct);
      case 'price':
        return views.sort((a, b) => a.currentPrice - b.currentPrice);
      default:
        return views.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
  }

  async detail(id: string, viewerId?: string): Promise<{ slot: SlotView; curve: CurvePoint[] }> {
    const slot = await this.repo.findById(id);
    if (!slot || (slot.isDemo && !viewerId)) throw new NotFoundError('Slot');
    const viewers = await this.presence.counts([id]);
    return {
      slot: this.mapper.toView(slot, { viewerId, viewers: viewers[id] }),
      curve: this.pricing.curve(slot, 80),
    };
  }

  async cities(): Promise<string[]> {
    const slots = await this.feedQuery.listOnSale({});
    return [...new Set(slots.map((s) => s.business.city))].sort();
  }
}
