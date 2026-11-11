import { Controller, Get, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { appConfig } from './common/config/app-config';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingModule } from './modules/booking/booking.module';
import { BusinessModule } from './modules/business/business.module';
import { DemoModule } from './modules/demo/demo.module';
import { EventsModule } from './modules/events/events.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SlotsModule } from './modules/slots/slots.module';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok', instance: appConfig.instanceId, time: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ScheduleModule.forRoot(),
    InfrastructureModule,
    AuthModule,
    RealtimeModule,
    EventsModule,
    PricingModule,
    SlotsModule,
    BookingModule,
    BusinessModule,
    NotificationsModule,
    DemoModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
