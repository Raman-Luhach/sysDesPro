import { Injectable } from '@nestjs/common';
import { appConfig } from '../../common/config/app-config';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/domain-errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { SlotChangePublisher } from './slot-change.publisher';
import { CreateSlotDto } from './slot.dto';
import { SlotRepository } from './slot.repository';
import { SlotStateResolver } from './slot-state';
import type { SlotRecord, SlotView } from './slot.types';
import { SlotViewMapper } from './slot-view.mapper';

const MAX_LEAD_TIME_MS = 7 * 24 * 60 * 60 * 1000;

/** Write-side use cases for merchants: create, publish, cancel. */
@Injectable()
export class SlotCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: SlotRepository,
    private readonly pricing: PricingService,
    private readonly mapper: SlotViewMapper,
    private readonly changes: SlotChangePublisher,
  ) {}

  async create(ownerId: string, dto: CreateSlotDto): Promise<SlotView> {
    const business = await this.prisma.business.findUnique({ where: { ownerId } });
    if (!business) throw new ValidationError('Set up your business profile before listing slots');

    const now = new Date();
    const startsAt = new Date(dto.startsAt);
    if (startsAt.getTime() < now.getTime() + appConfig.minLeadTimeMs) {
      throw new ValidationError('Slot must start at least 10 minutes from now');
    }
    if (startsAt.getTime() > now.getTime() + MAX_LEAD_TIME_MS) {
      throw new ValidationError('Flash slots can be listed at most 7 days ahead');
    }
    if (dto.floorPrice >= dto.basePrice) throw new ValidationError('Floor price must be lower than the starting price');
    if (dto.floorPrice < dto.basePrice * 0.05) throw new ValidationError('Floor price must be at least 5% of the starting price');

    const publish = dto.publishNow ?? true;
    const slot = await this.repo.create({
      businessId: business.id,
      title: dto.title.trim(),
      description: dto.description.trim(),
      category: business.category,
      startsAt,
      durationMin: dto.durationMin,
      basePrice: dto.basePrice,
      floorPrice: dto.floorPrice,
      strategy: dto.strategy,
      strategyParams: this.pricing.normaliseParams(dto.strategy, dto.strategyParams),
      status: publish ? 'LIVE' : 'DRAFT',
      liveAt: publish ? now : null,
    });
    if (publish) await this.changes.slotChanged(slot.id);
    return this.mapper.toView(slot);
  }

  async publish(ownerId: string, slotId: string): Promise<SlotView> {
    const slot = await this.ownedSlot(ownerId, slotId);
    if (!SlotStateResolver.resolve(slot).canPublish()) throw new ConflictError('Only drafts that have not started can be published');
    if (!(await this.repo.publish(slot.id, slot.version, new Date()))) throw new ConflictError('Slot changed, refresh and try again');
    await this.changes.slotChanged(slot.id);
    return this.mapper.toView((await this.repo.findById(slot.id))!);
  }

  async cancel(ownerId: string, slotId: string): Promise<SlotView> {
    const slot = await this.ownedSlot(ownerId, slotId);
    if (!SlotStateResolver.resolve(slot).canCancel()) {
      throw new ConflictError('This slot can no longer be cancelled (it is being bought or has ended)');
    }
    if (!(await this.repo.cancel(slot.id, slot.version))) throw new ConflictError('A buyer just grabbed this slot');
    await this.changes.slotChanged(slot.id);
    return this.mapper.toView((await this.repo.findById(slot.id))!);
  }

  private async ownedSlot(ownerId: string, slotId: string): Promise<SlotRecord> {
    const slot = await this.repo.findById(slotId);
    if (!slot) throw new NotFoundError('Slot');
    if (slot.business.ownerId !== ownerId) throw new ForbiddenError('This slot belongs to another business');
    return slot;
  }
}
