import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { Category, PricingStrategyKind } from '@prisma/client';

export const CATEGORIES: Category[] = ['SALON', 'FITNESS', 'DINING', 'WELLNESS', 'ENTERTAINMENT', 'CLASSES'];

export class CreateSlotDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  title: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsDateString()
  startsAt: string;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(480)
  durationMin: number;

  /** Paise. ₹10 .. ₹1,00,000 */
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(10_000_000)
  basePrice: number;

  @Type(() => Number)
  @IsInt()
  @Min(500)
  floorPrice: number;

  @IsIn(['LINEAR', 'STEP', 'EXPONENTIAL'])
  strategy: PricingStrategyKind;

  @IsOptional()
  @IsObject()
  strategyParams?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  publishNow?: boolean;
}

export class FeedQueryDto {
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: Category;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  @IsOptional()
  @IsIn(['ending', 'discount', 'price'])
  sort?: 'ending' | 'discount' | 'price';
}
