import { DomainError, ServiceUnavailableError } from '../../common/errors/domain-errors';

export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Consecutive infrastructure failures before opening. */
  failureThreshold: number;
  /** How long to stay open before allowing a trial call. */
  resetTimeoutMs: number;
  /** Per-call timeout. */
  timeoutMs: number;
}

/**
 * CIRCUIT BREAKER: if the payment provider keeps failing, stop calling it for a while
 * and fail fast, instead of making every buyer wait for timeouts.
 *   CLOSED (normal) --N failures--> OPEN (reject instantly) --timeout--> HALF_OPEN (one trial)
 *   HALF_OPEN --success--> CLOSED, --failure--> OPEN
 * Business declines (card declined) are not infrastructure failures and don't count.
 */
export class CircuitBreaker {
  private state: BreakerState = 'CLOSED';
  private failures = 0;
  private openedAt = 0;

  constructor(
    private readonly name: string,
    private readonly opts: CircuitBreakerOptions,
  ) {}

  get currentState(): BreakerState {
    if (this.state === 'OPEN' && Date.now() - this.openedAt >= this.opts.resetTimeoutMs) this.state = 'HALF_OPEN';
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.currentState === 'OPEN') {
      throw new ServiceUnavailableError(`${this.name} is temporarily unavailable, please retry shortly`);
    }
    try {
      const result = await this.withTimeout(fn());
      this.onSuccess();
      return result;
    } catch (e) {
      if (e instanceof DomainError && e.httpStatus < 500) {
        this.onSuccess(); // provider answered correctly, it just said "no"
      } else {
        this.onFailure();
      }
      throw e;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    if (this.state === 'HALF_OPEN' || this.failures >= this.opts.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }

  private withTimeout<T>(p: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ServiceUnavailableError(`${this.name} timed out`)), this.opts.timeoutMs);
    });
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
  }
}
