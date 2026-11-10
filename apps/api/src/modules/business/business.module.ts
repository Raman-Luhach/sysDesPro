import { Body, Controller, Get, Injectable, Module, Put } from '@nestjs/common';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { Category } from '@prisma/client';
import { NotFoundError } from '../../common/errors/domain-errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AuthUser } from '../auth/auth.types';
import { Auth, CurrentUser } from '../auth/guards';
import { ViewerPresenceService } from '../realtime/viewer-presence.service';
import { CATEGORIES } from '../slots/slot.dto';
import { SlotRepository } from '../slots/slot.repository';
import { SlotStateResolver } from '../slots/slot-state';
import { SlotViewMapper } from '../slots/slot-view.mapper';
import { SlotsModule } from '../slots/slots.module';

export class UpsertBusinessDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @IsIn(CATEGORIES)
  category: Category;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  city: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  address: string;

  @IsString()
  @MaxLength(300)
  description: string;
}

export interface MerchantStats {
  revenue: number;
  soldCount: number;
  liveCount: number;
  unsoldCount: number;
  avgDiscountPct: number;
  sellThroughPct: number;
}

@Injectable()
export class BusinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slots: SlotRepository,
    private readonly mapper: SlotViewMapper,
    private readonly presence: ViewerPresenceService,
  ) {}

  mine(ownerId: string) {
    return this.prisma.business.findUnique({ where: { ownerId } });
  }

  upsert(ownerId: string, dto: UpsertBusinessDto) {
    const data = { ...dto, name: dto.name.trim(), city: dto.city.trim(), address: dto.address.trim() };
    return this.prisma.business.upsert({ where: { ownerId }, create: { ownerId, ...data }, update: data });
  }

  async dashboard(ownerId: string) {
    const business = await this.mine(ownerId);
    if (!business) throw new NotFoundError('Business');
    const now = new Date();
    const records = await this.slots.listByBusiness(business.id);
    const viewers = await this.presence.counts(records.map((r) => r.id));
    const slots = records.map((r) => this.mapper.toView(r, { now, viewers: viewers[r.id] }));

    const sold = records.filter((r) => r.status === 'SOLD');
    const unsold = records.filter((r) => SlotStateResolver.resolve(r, now).status === 'EXPIRED');
    const live = slots.filter((s) => s.status === 'LIVE' || s.status === 'HELD');
    const stats: MerchantStats = {
      revenue: sold.reduce((sum, s) => sum + (s.soldPrice ?? 0), 0),
      soldCount: sold.length,
      liveCount: live.length,
      unsoldCount: unsold.length,
      avgDiscountPct: sold.length
        ? Math.round((sold.reduce((sum, s) => sum + (1 - (s.soldPrice ?? s.basePrice) / s.basePrice), 0) / sold.length) * 100)
        : 0,
      sellThroughPct: sold.length + unsold.length ? Math.round((sold.length / (sold.length + unsold.length)) * 100) : 0,
    };
    return { business, stats, slots };
  }
}

@Auth('MERCHANT')
@Controller('business')
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Get('me')
  async mine(@CurrentUser() user: AuthUser) {
    return { business: await this.business.mine(user.id) };
  }

  @Put('me')
  upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertBusinessDto) {
    return this.business.upsert(user.id, dto);
  }

  @Get('me/dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.business.dashboard(user.id);
  }
}

@Module({
  imports: [SlotsModule],
  controllers: [BusinessController],
  providers: [BusinessService],
})
export class BusinessModule {}
