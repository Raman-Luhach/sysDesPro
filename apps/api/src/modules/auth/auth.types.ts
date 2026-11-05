import type { Role } from '@prisma/client';

/** The authenticated principal attached to each request. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
}
