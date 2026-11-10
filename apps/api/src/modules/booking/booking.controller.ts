import { Body, Controller, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { RateLimit } from '../../infrastructure/rate-limit/rate-limit.guard';
import type { AuthUser } from '../auth/auth.types';
import { Auth, CurrentUser } from '../auth/guards';
import type { PaymentMethod } from '../payment/payment-gateway';
import { BookingService } from './booking.service';

export class CheckoutDto {
  @IsIn(['UPI', 'CARD', 'WALLET'])
  paymentMethod: PaymentMethod;
}

@Controller()
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  /** Phase 1: reserve the slot and lock the price. */
  @RateLimit('hold', 6, 0.2)
  @Auth('CUSTOMER', 'ADMIN')
  @Post('slots/:id/hold')
  @HttpCode(200)
  hold(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookings.hold(id, user.id);
  }

  @Auth()
  @Post('slots/:id/release')
  @HttpCode(204)
  release(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookings.release(id, user.id);
  }

  /** Phase 2: pay and confirm. Requires an Idempotency-Key header. */
  @RateLimit('checkout', 5, 0.2)
  @Auth('CUSTOMER', 'ADMIN')
  @Post('slots/:id/checkout')
  @HttpCode(200)
  checkout(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CheckoutDto,
  ) {
    return this.bookings.checkout(id, user.id, idempotencyKey, dto.paymentMethod);
  }

  @Auth()
  @Get('bookings/me')
  mine(@CurrentUser() user: AuthUser) {
    return this.bookings.myBookings(user.id);
  }
}
