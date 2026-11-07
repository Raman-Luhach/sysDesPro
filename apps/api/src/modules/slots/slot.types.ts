import type { Category, PricingStrategyKind, Prisma, SlotStatus } from '@prisma/client';

export type SlotRecord = Prisma.SlotGetPayload<{ include: { business: true } }>;

export interface FeedFilter {
  category?: Category;
  city?: string;
}

/** Public, client-facing representation of a slot with its live price. */
export interface SlotView {
  id: string;
  title: string;
  description: string;
  category: Category;
  business: { id: string; name: string; city: string; address: string };
  startsAt: string;
  durationMin: number;
  basePrice: number;
  floorPrice: number;
  currentPrice: number;
  discountPct: number;
  strategy: PricingStrategyKind;
  strategyParams: Record<string, number>;
  status: SlotStatus;
  liveAt: string | null;
  nextDropAt: string | null;
  holdExpiresAt: string | null;
  soldPrice: number | null;
  viewers: number;
  /** Present only when the requesting user holds the slot. */
  myHold: { price: number; expiresAt: string } | null;
}
