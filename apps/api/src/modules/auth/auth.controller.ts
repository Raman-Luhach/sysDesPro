import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { RateLimit } from '../../infrastructure/rate-limit/rate-limit.guard';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.types';
import { Auth, CurrentUser } from './guards';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @RateLimit('register', 5, 0.1)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @RateLimit('login', 10, 0.2)
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Auth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
