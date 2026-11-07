import { Inject, Injectable } from '@nestjs/common';
import type { PricingStrategyKind } from '@prisma/client';
import { ValidationError } from '../../common/errors/domain-errors';
import { PriceCurveInput, PricingStrategy, StrategyDescriptor } from './pricing-strategy';

export const PRICING_STRATEGIES = Symbol('PRICING_STRATEGIES');

/** Anything slot-shaped can be priced. Keeps pricing independent of the Prisma model. */
export interface Priceable {
  basePrice: number;
  floorPrice: number;
  liveAt: Date | null;
  startsAt: Date;
  strategy: PricingStrategyKind;
  strategyParams: unknown;
}

export interface CurvePoint {
  at: string;
  price: number;
}

/**
 * Facade over the strategy registry. Strategies are injected as a list (Open/Closed:
 * a new curve = a new class registered in PricingModule, no edits here).
 */
@Injectable()
export class PricingService {
  private readonly registry: Map<PricingStrategyKind, PricingStrategy>;

  constructor(@Inject(PRICING_STRATEGIES) strategies: PricingStrategy[]) {
    this.registry = new Map(strategies.map((s) => [s.kind, s]));
  }

  strategy(kind: PricingStrategyKind): PricingStrategy {
    const s = this.registry.get(kind);
    if (!s) throw new ValidationError(`Unknown pricing strategy ${kind}`);
    return s;
  }

  descriptors(): StrategyDescriptor[] {
    return [...this.registry.values()].map((s) => s.descriptor);
  }

  priceAt(slot: Priceable, now = new Date()): number {
    return this.strategy(slot.strategy).priceAt(this.toInput(slot), now);
  }

  nextDropAt(slot: Priceable, now = new Date()): Date | null {
    return this.strategy(slot.strategy).nextDropAt(this.toInput(slot), now);
  }

  normaliseParams(kind: PricingStrategyKind, params: unknown): Record<string, number> {
    return this.strategy(kind).normaliseParams((params ?? {}) as Record<string, unknown>);
  }

  /** Sample the curve for charts (single source of truth for both preview and live view). */
  curve(slot: Priceable, points = 60): CurvePoint[] {
    const input = this.toInput(slot);
    const strategy = this.strategy(slot.strategy);
    const start = (input.liveAt ?? new Date()).getTime();
    const end = input.closesAt.getTime();
    const effective = { ...input, liveAt: new Date(start) };
    const out: CurvePoint[] = [];
    for (let i = 0; i <= points; i++) {
      const t = new Date(start + ((end - start) * i) / points);
      out.push({ at: t.toISOString(), price: strategy.priceAt(effective, t) });
    }
    return out;
  }

  private toInput(slot: Priceable): PriceCurveInput {
    return {
      basePrice: slot.basePrice,
      floorPrice: slot.floorPrice,
      liveAt: slot.liveAt,
      closesAt: slot.startsAt,
      params: (slot.strategyParams ?? {}) as Record<string, unknown>,
    };
  }
}
