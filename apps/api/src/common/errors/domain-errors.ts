/**
 * Domain errors carry a stable machine-readable `code` and an HTTP status.
 * Services throw these; a single global filter turns them into JSON responses,
 * so business logic never depends on HTTP framework classes (DIP).
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string) {
    super('NOT_FOUND', `${what} not found`, 404);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super('VALIDATION_FAILED', message, 400);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Please sign in to continue') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'You are not allowed to do this') {
    super('FORBIDDEN', message, 403);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, code = 'CONFLICT') {
    super(code, message, 409);
  }
}

/** Another buyer already holds the slot (rejected by the Redis gate, no DB hit). */
export class HoldContestedError extends DomainError {
  constructor() {
    super('HOLD_CONTESTED', 'Someone else is checking out this slot right now', 409);
  }
}

/** The slot changed state underneath us (rejected by the DB optimistic lock). */
export class SlotUnavailableError extends DomainError {
  constructor(message = 'This slot is no longer available') {
    super('SLOT_UNAVAILABLE', message, 409);
  }
}

export class HoldExpiredError extends DomainError {
  constructor() {
    super('HOLD_EXPIRED', 'Your hold expired before payment completed', 410);
  }
}

export class RateLimitedError extends DomainError {
  constructor(retryAfterMs: number) {
    super('RATE_LIMITED', 'Too many requests, slow down a little', 429, { retryAfterMs });
  }
}

export class PaymentFailedError extends DomainError {
  constructor(message = 'Payment was declined') {
    super('PAYMENT_FAILED', message, 402);
  }
}

export class ServiceUnavailableError extends DomainError {
  constructor(message: string) {
    super('SERVICE_UNAVAILABLE', message, 503);
  }
}
