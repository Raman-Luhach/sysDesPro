import { CircuitBreaker } from './circuit-breaker';
import { ChargeRequest, ChargeResult, PaymentGateway } from './payment-gateway';

/**
 * DECORATOR: adds resilience to ANY PaymentGateway without changing it.
 * The booking service can't tell the difference (same interface).
 */
export class ResilientPaymentGateway extends PaymentGateway {
  constructor(
    private readonly inner: PaymentGateway,
    private readonly breaker: CircuitBreaker,
  ) {
    super();
  }

  charge(req: ChargeRequest): Promise<ChargeResult> {
    return this.breaker.execute(() => this.inner.charge(req));
  }

  refund(paymentRef: string): Promise<void> {
    // Refunds bypass the breaker: we must always try to give money back.
    return this.inner.refund(paymentRef);
  }
}
