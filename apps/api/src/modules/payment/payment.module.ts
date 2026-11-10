import { Module } from '@nestjs/common';
import { appConfig } from '../../common/config/app-config';
import { CircuitBreaker } from './circuit-breaker';
import { MockPaymentGateway } from './mock-payment.gateway';
import { PaymentGateway } from './payment-gateway';
import { ResilientPaymentGateway } from './resilient-payment.gateway';

@Module({
  providers: [
    {
      // Composition root: swap MockPaymentGateway for a RazorpayGateway here and nothing else changes.
      provide: PaymentGateway,
      useFactory: () =>
        new ResilientPaymentGateway(
          new MockPaymentGateway(appConfig.payment),
          new CircuitBreaker('Payment provider', { failureThreshold: 5, resetTimeoutMs: 15_000, timeoutMs: 8_000 }),
        ),
    },
  ],
  exports: [PaymentGateway],
})
export class PaymentModule {}
