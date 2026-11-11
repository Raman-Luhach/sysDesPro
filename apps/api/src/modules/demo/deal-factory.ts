import type { Prisma } from '@prisma/client';
import type { DealTemplate } from './deal-catalog';

const MIN = 60_000;

/**
 * Builds a LIVE slot from a template, starting 25 min to 4 h from now and already on sale
 * for a while, so the feed shows a realistic mix of fresh and deeply discounted deals.
 */
export function buildLiveDeal(t: DealTemplate, businessId: string, category: Prisma.SlotUncheckedCreateInput['category'], now: Date) {
  const startsInMin = 25 + Math.floor(Math.random() * 215);
  const startsAt = new Date(Math.ceil((now.getTime() + startsInMin * MIN) / (5 * MIN)) * (5 * MIN));
  const liveForMin = 10 + Math.floor(Math.random() * 100);
  const data: Prisma.SlotUncheckedCreateInput = {
    businessId,
    category,
    title: t.title,
    description: t.description,
    durationMin: t.durationMin,
    startsAt,
    basePrice: t.base * 100,
    floorPrice: t.floor * 100,
    strategy: t.strategy,
    strategyParams: t.params ?? {},
    status: 'LIVE',
    liveAt: new Date(now.getTime() - liveForMin * MIN),
  };
  return data;
}
