import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { appConfig } from '../../common/config/app-config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard, OptionalAuthGuard, RolesGuard, TokenVerifier } from './guards';
import { BcryptPasswordHasher, PasswordHasher } from './password-hasher';

@Global()
@Module({
  imports: [JwtModule.register({ secret: appConfig.jwtSecret, signOptions: { expiresIn: appConfig.jwtExpiresIn } })],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenVerifier,
    JwtAuthGuard,
    OptionalAuthGuard,
    RolesGuard,
    { provide: PasswordHasher, useClass: BcryptPasswordHasher },
  ],
  exports: [TokenVerifier, JwtAuthGuard, OptionalAuthGuard, RolesGuard, PasswordHasher],
})
export class AuthModule {}
