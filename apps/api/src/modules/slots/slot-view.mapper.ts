import { Injectable } from '@nestjs/common';
import { PricingService } from '../pricing/pricing.service';
import { SlotStateResolver } from './slot-state';
import type { SlotRecord, SlotView } from './slot.types';

/** Turns a stored slot into what clients see, with the live price computed for `now`. */
@Injectable()
export class SlotViewMapper {
  constructor(private readonly pricing: PricingService) {}

  toView(slot: SlotRecord, opts: { now?: Date; viewerId?: string; viewers?: number } = {}): SlotView {
    const now = opts.now ?? new Date();
    const state = SlotStateResolver.resolve(slot, now);
    const status = state.status;
    const onSale = status === 'LIVE' || status === 'HELD';
    const currentPrice =
      status === 'SOLD' ? (slot.soldPrice ?? slot.floorPrice) : onSale ? this.pricing.priceAt(slot, now) : slot.basePrice;
    const nextDrop = onSale ? this.pricing.nextDropAt(slot, now) : null;
    const myHold =
      opts.viewerId && state.isHeldBy(opts.viewerId) && slot.heldPrice && slot.holdExpiresAt
        ? { price: slot.heldPrice, expiresAt: slot.holdExpiresAt.toISOString() }
        : null;

    return {
      id: slot.id,
      title: slot.title,
      description: slot.description,
      category: slot.category,
      business: { id: slot.business.id, name: slot.business.name, city: slot.business.city, address: slot.business.address },
      startsAt: slot.startsAt.toISOString(),
      durationMin: slot.durationMin,
      basePrice: slot.basePrice,
      floorPrice: slot.floorPrice,
      currentPrice,
      discountPct: Math.round((1 - currentPrice / slot.basePrice) * 100),
      strategy: slot.strategy,
      strategyParams: this.pricing.normaliseParams(slot.strategy, slot.strategyParams),
      status,
      liveAt: slot.liveAt?.toISOString() ?? null,
      nextDropAt: nextDrop?.toISOString() ?? null,
      holdExpiresAt: status === 'HELD' ? (slot.holdExpiresAt?.toISOString() ?? null) : null,
      soldPrice: slot.soldPrice,
      viewers: opts.viewers ?? 0,
      myHold,
    };
  }
}
