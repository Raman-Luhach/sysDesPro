import { Module } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PaymentModule } from '../payment/payment.module';
import { SlotsModule } from '../slots/slots.module';
import { BookingController } from './booking.controller';
import { buildHoldRuleChain } from './booking-rules';
import { BookingService, HOLD_RULES } from './booking.service';
import { HoldGate } from './hold-gate';
import { IdempotencyLock } from './idempotency';

@Module({
  imports: [SlotsModule, PaymentModule],
  controllers: [BookingController],
  providers: [
    HoldGate,
    IdempotencyLock,
    { provide: HOLD_RULES, useFactory: (prisma: PrismaService) => buildHoldRuleChain(prisma), inject: [PrismaService] },
    BookingService,
  ],
  exports: [BookingService],
})
export class BookingModule {}
