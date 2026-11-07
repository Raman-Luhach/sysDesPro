import { Injectable } from '@nestjs/common';
import { PriceCurveInput, PricingStrategy, StrategyDescriptor } from './pricing-strategy';

/** Price falls at a constant rate from base to floor. */
@Injectable()
export class LinearPricingStrategy extends PricingStrategy {
  readonly descriptor: StrategyDescriptor = {
    kind: 'LINEAR',
    label: 'Steady glide',
    description: 'Price falls smoothly at a constant rate until the slot starts.',
    params: [],
  };

  protected discountFraction(p: number): number {
    return p;
  }
}

/** Price drops in N equal steps, e.g. every 15 minutes. Creates "next drop in 4:12" urgency. */
@Injectable()
export class StepPricingStrategy extends PricingStrategy {
  readonly descriptor: StrategyDescriptor = {
    kind: 'STEP',
    label: 'Timed drops',
    description: 'Price holds, then drops by a fixed amount at regular intervals.',
    params: [{ key: 'steps', label: 'Number of drops', min: 2, max: 20, default: 6 }],
  };

  protected discountFraction(p: number, params: Record<string, number>): number {
    const steps = Math.round(params.steps);
    return Math.floor(p * steps) / steps;
  }

  override nextDropAt(input: PriceCurveInput, now: Date): Date | null {
    if (!input.liveAt) return null;
    const steps = Math.round(this.normaliseParams(input.params).steps);
    const p = this.progress(input, now);
    if (p >= 1) return null;
    const nextStep = Math.floor(p * steps) + 1;
    const span = input.closesAt.getTime() - input.liveAt.getTime();
    const at = input.liveAt.getTime() + (span * nextStep) / steps;
    return at >= input.closesAt.getTime() ? null : new Date(at);
  }
}

/**
 * Accelerating ("last-minute plunge"): price barely moves at first, then falls faster and
 * faster as the start time approaches. Protects margin early, clears inventory late.
 * fraction = (e^(k*p) - 1) / (e^k - 1)
 */
@Injectable()
export class ExponentialPricingStrategy extends PricingStrategy {
  readonly descriptor: StrategyDescriptor = {
    kind: 'EXPONENTIAL',
    label: 'Last-minute plunge',
    description: 'Holds close to full price early, then plunges as the start time gets close.',
    params: [{ key: 'steepness', label: 'Steepness', min: 1, max: 8, default: 3 }],
  };

  protected discountFraction(p: number, params: Record<string, number>): number {
    const k = params.steepness;
    return (Math.exp(k * p) - 1) / (Math.exp(k) - 1);
  }
}
