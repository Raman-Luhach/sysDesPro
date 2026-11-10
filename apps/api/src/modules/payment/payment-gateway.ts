export type PaymentMethod = 'UPI' | 'CARD' | 'WALLET';

export interface ChargeRequest {
  /** Paise. */
  amount: number;
  method: PaymentMethod;
  /** Idempotency reference: charging twice with the same reference charges once. */
  reference: string;
  description: string;
}

export interface ChargeResult {
  paymentRef: string;
  amount: number;
}

/**
 * Port for any payment provider. Booking logic depends only on this abstraction, so
 * Razorpay/Stripe/mock are interchangeable (Liskov + Dependency Inversion).
 */
export abstract class PaymentGateway {
  abstract charge(req: ChargeRequest): Promise<ChargeResult>;
  abstract refund(paymentRef: string): Promise<void>;
}
