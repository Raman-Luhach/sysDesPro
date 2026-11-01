import { applyDecorators, CanActivate, ExecutionContext, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RateLimitedError } from '../../common/errors/domain-errors';
import type { AuthUser } from '../../modules/auth/auth.types';
import { RateLimitPolicy, TokenBucketLimiter } from './token-bucket.limiter';

const RATE_LIMIT_KEY = 'rateLimit';

interface NamedPolicy extends RateLimitPolicy {
  name: string;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: TokenBucketLimiter,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.get<NamedPolicy | undefined>(RATE_LIMIT_KEY, ctx.getHandler());
    if (!policy) return true;
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    // Per user when signed in, otherwise per client IP.
    const who = req.user?.id ?? req.ip ?? 'anon';
    // Fail open: if Redis is down we'd rather serve buyers than block everyone.
    const decision = await this.limiter.consume(`${policy.name}:${who}`, policy).catch(() => null);
    if (decision && !decision.allowed) throw new RateLimitedError(decision.retryAfterMs);
    return true;
  }
}

/**
 * Rate-limit a route with a token bucket.
 * Place it ABOVE @Auth() so authentication runs first and the bucket is keyed per user.
 */
export function RateLimit(name: string, capacity: number, refillPerSec: number) {
  return applyDecorators(SetMetadata(RATE_LIMIT_KEY, { name, capacity, refillPerSec }), UseGuards(RateLimitGuard));
}
