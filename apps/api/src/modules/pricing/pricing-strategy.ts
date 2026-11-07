import type { PricingStrategyKind } from '@prisma/client';
import { roundToRupee } from '../../common/money';

/** Everything a strategy needs to price a slot. Plain data, no ORM types (keeps pricing pure). */
export interface PriceCurveInput {
  basePrice: number;
  floorPrice: number;
  /** When the price starts dropping (publish time). Null = not published, so price = base. */
  liveAt: Date | null;
  /** When the price reaches the floor and sales close (slot start time). */
  closesAt: Date;
  params: Record<string, unknown>;
}

export interface StrategyDescriptor {
  kind: PricingStrategyKind;
  label: string;
  description: string;
  params: Array<{ key: string; label: string; min: number; max: number; default: number }>;
}

/**
 * STRATEGY pattern: each subclass is one price-drop curve.
 * TEMPLATE METHOD: `priceAt` is the fixed algorithm (progress -> discount -> clamp -> round);
 * subclasses only supply `discountFraction`, the shape of the curve.
 *
 * Price is a pure function of time, so nothing is written to the DB on every tick:
 * any instance can compute the exact same price at any moment.
 */
export abstract class PricingStrategy {
  abstract readonly descriptor: StrategyDescriptor;

  get kind(): PricingStrategyKind {
    return this.descriptor.kind;
  }

  /** Fraction of the (base - floor) discount applied at progress p in [0, 1]. Must be 0 at p=0, 1 at p=1. */
  protected abstract discountFraction(progress: number, params: Record<string, number>): number;

  priceAt(input: PriceCurveInput, now: Date): number {
    const p = this.progress(input, now);
    const params = this.normaliseParams(input.params);
    const fraction = clamp(this.discountFraction(p, params), 0, 1);
    const raw = input.basePrice - (input.basePrice - input.floorPrice) * fraction;
    return clamp(roundToRupee(raw), input.floorPrice, input.basePrice);
  }

  /** When the next price change happens. Continuous curves change every tick, so null. */
  nextDropAt(_input: PriceCurveInput, _now: Date): Date | null {
    return null;
  }

  /** Fill in defaults and clamp user-supplied params into allowed ranges. */
  normaliseParams(params: Record<string, unknown> = {}): Record<string, number> {
    const out: Record<string, number> = {};
    for (const p of this.descriptor.params) {
      const v = Number(params[p.key]);
      out[p.key] = Number.isFinite(v) ? clamp(v, p.min, p.max) : p.default;
    }
    return out;
  }

  protected progress(input: PriceCurveInput, now: Date): number {
    if (!input.liveAt) return 0;
    const span = input.closesAt.getTime() - input.liveAt.getTime();
    if (span <= 0) return 1;
    return clamp((now.getTime() - input.liveAt.getTime()) / span, 0, 1);
  }
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
