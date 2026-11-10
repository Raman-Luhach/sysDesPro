import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { Auth, CurrentUser, OptionalAuth } from '../auth/guards';
import { CreateSlotDto, FeedQueryDto } from './slot.dto';
import { SlotCommandService } from './slot-command.service';
import { SlotFeedService } from './slot-feed.service';

@Controller('slots')
export class SlotsController {
  constructor(
    private readonly feed: SlotFeedService,
    private readonly commands: SlotCommandService,
  ) {}

  @OptionalAuth()
  @Get()
  list(@Query() q: FeedQueryDto, @CurrentUser() user?: AuthUser) {
    return this.feed.feed(q, user?.id);
  }

  @Get('cities')
  cities() {
    return this.feed.cities();
  }

  @OptionalAuth()
  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.feed.detail(id, user?.id);
  }

  @Auth('MERCHANT')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSlotDto) {
    return this.commands.create(user.id, dto);
  }

  @Auth('MERCHANT')
  @Post(':id/publish')
  @HttpCode(200)
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commands.publish(user.id, id);
  }

  @Auth('MERCHANT')
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commands.cancel(user.id, id);
  }
}
