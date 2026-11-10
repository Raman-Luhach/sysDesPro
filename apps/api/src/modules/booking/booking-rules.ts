import { ConflictError, ForbiddenError, SlotUnavailableError } from '../../common/errors/domain-errors';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { SlotState } from '../slots/slot-state';
import type { SlotRecord } from '../slots/slot.types';

export interface HoldContext {
  slot: SlotRecord;
  state: SlotState;
  userId: string;
  now: Date;
}

/**
 * CHAIN OF RESPONSIBILITY: each rule checks one thing and passes the request on.
 * Adding a rule (e.g. "max 3 bookings per day") = one new class added to the chain.
 */
export abstract class BookingRule {
  private next?: BookingRule;

  setNext(rule: BookingRule): BookingRule {
    this.next = rule;
    return rule;
  }

  async check(ctx: HoldContext): Promise<void> {
    await this.validate(ctx);
    await this.next?.check(ctx);
  }

  protected abstract validate(ctx: HoldContext): Promise<void> | void;
}

/** The slot must currently be on sale. */
export class SlotOnSaleRule extends BookingRule {
  protected validate({ state }: HoldContext): void {
    if (state.canHold()) return;
    switch (state.status) {
      case 'HELD':
        throw new ConflictError('Someone else is checking out this slot right now', 'SLOT_HELD');
      case 'SOLD':
        throw new SlotUnavailableError('This slot has already been sold');
      case 'EXPIRED':
        throw new SlotUnavailableError('This slot has already started');
      default:
        throw new SlotUnavailableError('This slot is not on sale');
    }
  }
}

/** Merchants can't buy their own inventory (prevents fake demand). */
export class NotOwnSlotRule extends BookingRule {
  protected validate({ slot, userId }: HoldContext): void {
    if (slot.business.ownerId === userId) throw new ForbiddenError("You can't book your own business's slot");
  }
}

/** One checkout at a time per buyer: stops one person hoarding many slots. */
export class SingleActiveHoldRule extends BookingRule {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  protected async validate({ userId, slot, now }: HoldContext): Promise<void> {
    const other = await this.prisma.slot.findFirst({
      where: { status: 'HELD', holdUserId: userId, holdExpiresAt: { gt: now }, id: { not: slot.id } },
      select: { title: true },
    });
    if (other) throw new ConflictError(`Finish or cancel your checkout for "${other.title}" first`, 'ACTIVE_HOLD_EXISTS');
  }
}

export function buildHoldRuleChain(prisma: PrismaService): BookingRule {
  const head = new SlotOnSaleRule();
  head.setNext(new NotOwnSlotRule()).setNext(new SingleActiveHoldRule(prisma));
  return head;
}
