import {
  applyDecorators,
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import type { Request } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../common/errors/domain-errors';
import type { AuthUser, JwtPayload } from './auth.types';

type AuthedRequest = Request & { user?: AuthUser };
const ROLES_KEY = 'roles';

function bearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

@Injectable()
export class TokenVerifier {
  constructor(private readonly jwt: JwtService) {}

  async verify(token: string | undefined): Promise<AuthUser | null> {
    if (!token) return null;
    try {
      const p = await this.jwt.verifyAsync<JwtPayload>(token);
      return { id: p.sub, email: p.email, name: p.name, role: p.role };
    } catch {
      return null;
    }
  }
}

/** Requires a valid JWT. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenVerifier) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const user = await this.tokens.verify(bearer(req));
    if (!user) throw new UnauthorizedError();
    req.user = user;
    return true;
  }
}

/** Attaches the user if a valid JWT is present, but never rejects. */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenVerifier) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    req.user = (await this.tokens.verify(bearer(req))) ?? undefined;
    return true;
  }
}

/** Role-based access control. Runs after JwtAuthGuard. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenError();
    return true;
  }
}

/** `@Auth()` = must be signed in. `@Auth('MERCHANT')` = must also have that role. */
export function Auth(...roles: Role[]) {
  return applyDecorators(SetMetadata(ROLES_KEY, roles), UseGuards(JwtAuthGuard, RolesGuard));
}

export function OptionalAuth() {
  return UseGuards(OptionalAuthGuard);
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});
