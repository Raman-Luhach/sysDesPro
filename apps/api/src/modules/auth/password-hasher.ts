import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

/**
 * Abstraction for password hashing (Dependency Inversion): AuthService depends on this
 * contract, not on bcrypt. Swapping to argon2 means adding a class, not editing AuthService.
 */
export abstract class PasswordHasher {
  abstract hash(plain: string): Promise<string>;
  abstract verify(plain: string, hash: string): Promise<boolean>;
}

@Injectable()
export class BcryptPasswordHasher extends PasswordHasher {
  private static readonly COST = 10;

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, BcryptPasswordHasher.COST);
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plain, hash);
    } catch {
      return false;
    }
  }
}
