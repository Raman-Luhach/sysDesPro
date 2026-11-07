import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { PRICING_STRATEGIES, PricingService } from './pricing.service';
import { ExponentialPricingStrategy, LinearPricingStrategy, StepPricingStrategy } from './strategies';

/** To add a new price curve: write a PricingStrategy subclass and add it to this list. */
const STRATEGIES = [LinearPricingStrategy, StepPricingStrategy, ExponentialPricingStrategy];

@Module({
  controllers: [PricingController],
  providers: [
    ...STRATEGIES,
    {
      provide: PRICING_STRATEGIES,
      useFactory: (...strategies: unknown[]) => strategies,
      inject: STRATEGIES,
    },
    PricingService,
  ],
  exports: [PricingService],
})
export class PricingModule {}
