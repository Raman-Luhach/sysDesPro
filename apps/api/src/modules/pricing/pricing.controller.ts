import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';
import type { PricingStrategyKind } from '@prisma/client';
import { ValidationError } from '../../common/errors/domain-errors';
import { PricingService } from './pricing.service';

export class PreviewCurveDto {
  @IsIn(['LINEAR', 'STEP', 'EXPONENTIAL'])
  strategy: PricingStrategyKind;

  @IsOptional()
  @IsObject()
  strategyParams?: Record<string, unknown>;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  basePrice: number;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  floorPrice: number;

  @IsDateString()
  liveAt: string;

  @IsDateString()
  startsAt: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(200)
  points?: number;
}

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('strategies')
  strategies() {
    return this.pricing.descriptors();
  }

  /** Lets the merchant UI preview a curve before publishing. Same code path as live pricing. */
  @Post('preview')
  @HttpCode(200)
  preview(@Body() dto: PreviewCurveDto) {
    if (dto.floorPrice > dto.basePrice) throw new ValidationError('Floor price cannot exceed the starting price');
    const slot = {
      basePrice: dto.basePrice,
      floorPrice: dto.floorPrice,
      liveAt: new Date(dto.liveAt),
      startsAt: new Date(dto.startsAt),
      strategy: dto.strategy,
      strategyParams: dto.strategyParams ?? {},
    };
    if (slot.startsAt <= slot.liveAt) throw new ValidationError('Start time must be after the go-live time');
    return { points: this.pricing.curve(slot, dto.points ?? 60) };
  }
}
