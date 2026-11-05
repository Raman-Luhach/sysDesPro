import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../common/errors/domain-errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';
import type { AuthUser, JwtPayload } from './auth.types';
import { PasswordHasher } from './password-hasher';

export interface AuthResult {
  token: string;
  user: AuthUser & { hasBusiness: boolean };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictError('An account with this email already exists', 'EMAIL_TAKEN');
    const user = await this.prisma.user.create({
      data: { name: dto.name.trim(), email: dto.email, role: dto.role, passwordHash: await this.hasher.hash(dto.password) },
    });
    return this.issue(user, false);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email }, include: { business: true } });
    // Same error for unknown email and wrong password: don't leak which emails exist.
    if (!user || user.isBot || !(await this.hasher.verify(dto.password, user.passwordHash))) {
      throw new UnauthorizedError('Incorrect email or password');
    }
    return this.issue(user, !!user.business);
  }

  async me(userId: string): Promise<AuthResult['user']> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { business: true } });
    if (!user) throw new NotFoundError('User');
    return { ...this.toAuthUser(user), hasBusiness: !!user.business };
  }

  private async issue(user: User, hasBusiness: boolean): Promise<AuthResult> {
    const payload: JwtPayload = { sub: user.id, email: user.email, name: user.name, role: user.role };
    return { token: await this.jwt.signAsync(payload), user: { ...this.toAuthUser(user), hasBusiness } };
  }

  private toAuthUser(u: User): AuthUser {
    return { id: u.id, email: u.email, name: u.name, role: u.role };
  }
}
