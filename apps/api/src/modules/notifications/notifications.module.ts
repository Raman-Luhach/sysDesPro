import { Controller, Get, HttpCode, Module, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { Auth, CurrentUser } from '../auth/guards';
import { NotificationsService } from './notifications.service';

@Auth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.id);
  }

  @Post('read-all')
  @HttpCode(204)
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }
}

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
