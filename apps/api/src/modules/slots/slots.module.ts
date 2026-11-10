import { Module } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { PricingModule } from '../pricing/pricing.module';
import { SlotChangePublisher } from './slot-change.publisher';
import { SlotCommandService } from './slot-command.service';
import { SlotFeedService } from './slot-feed.service';
import { PriceTicker, SlotLifecycleSweeper } from './slot-jobs';
import { CachedSlotFeedQuery, DbSlotFeedQuery, SlotCacheInvalidator, SlotFeedQuery } from './slot-query';
import { SlotRepository } from './slot.repository';
import { SlotViewMapper } from './slot-view.mapper';
import { SlotsController } from './slots.controller';

@Module({
  imports: [PricingModule],
  controllers: [SlotsController],
  providers: [
    SlotRepository,
    DbSlotFeedQuery,
    // The feed query everyone gets is the DB query wrapped in the cache decorator.
    {
      provide: SlotFeedQuery,
      useFactory: (db: DbSlotFeedQuery, redis: RedisService) => new CachedSlotFeedQuery(db, redis),
      inject: [DbSlotFeedQuery, RedisService],
    },
    SlotCacheInvalidator,
    SlotViewMapper,
    SlotChangePublisher,
    SlotCommandService,
    SlotFeedService,
    PriceTicker,
    SlotLifecycleSweeper,
  ],
  exports: [SlotRepository, SlotViewMapper, SlotChangePublisher, PricingModule],
})
export class SlotsModule {}
