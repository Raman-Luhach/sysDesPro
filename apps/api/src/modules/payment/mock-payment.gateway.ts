import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PaymentFailedError } from '../../common/errors/domain-errors';
import { ChargeRequest, ChargeResult, PaymentGateway } from './payment-gateway';

export interface MockGatewayOptions {
  latencyMs: number;
  /** 0..1 probability that a charge is declined. */
  failureRate: number;
}

/**
 * ADAPTER stand-in for a real provider (e.g. Razorpay). Simulates network latency,
 * random declines, and provider-side idempotency on `reference`.
 */
export class MockPaymentGateway extends PaymentGateway {
  private readonly logger = new Logger('MockPaymentGateway');
  private readonly charges = new Map<string, ChargeResult>();

  constructor(private readonly opts: MockGatewayOptions) {
    super();
  }

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    const previous = this.charges.get(req.reference);
    if (previous) return previous;

    await sleep(this.opts.latencyMs * (0.6 + Math.random() * 0.8));
    if (Math.random() < this.opts.failureRate) throw new PaymentFailedError('Your bank declined the payment, try another method');

    const result = { paymentRef: `pay_${randomUUID().replace(/-/g, '').slice(0, 14)}`, amount: req.amount };
    this.charges.set(req.reference, result);
    this.logger.log(`Charged ${req.amount / 100} INR via ${req.method} (${result.paymentRef})`);
    return result;
  }

  async refund(paymentRef: string): Promise<void> {
    await sleep(this.opts.latencyMs / 2);
    this.logger.log(`Refunded ${paymentRef}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
