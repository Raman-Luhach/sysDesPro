import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { appConfig } from '../../common/config/app-config';
import {
  ConflictError,
  HoldContestedError,
  HoldExpiredError,
  NotFoundError,
  SlotUnavailableError,
  ValidationError,
} from '../../common/errors/domain-errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OutboxWriter } from '../events/outbox';
import { PaymentGateway, PaymentMethod } from '../payment/payment-gateway';
import { PricingService } from '../pricing/pricing.service';
import { SlotChangePublisher } from '../slots/slot-change.publisher';
import { SlotRepository } from '../slots/slot.repository';
import { SlotStateResolver } from '../slots/slot-state';
import { BookingRule } from './booking-rules';
import { HoldGate } from './hold-gate';
import { IdempotencyLock } from './idempotency';

export const HOLD_RULES = Symbol('HOLD_RULES');

export interface HoldView {
  slotId: string;
  price: number;
  expiresAt: string;
}

export interface BookingView {
  id: string;
  code: string;
  slotId: string;
  title: string;
  businessName: string;
  address: string;
  startsAt: string;
  durationMin: number;
  pricePaid: number;
  originalPrice: number;
  paymentRef: string;
  paymentMethod: string;
  createdAt: string;
}

export interface HoldOptions {
  /** Concurrency Lab only: skip the Redis gate to prove the DB lock alone is enough. */
  useGate?: boolean;
}

const bookingInclude = { slot: { include: { business: true } } } as const;
type BookingRecord = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

/**
 * Orchestrates the two-phase purchase:
 *   1. hold(): reserve the slot for 2 minutes and LOCK the price at that instant.
 *   2. checkout(): charge, then atomically mark SOLD + create booking + write outbox event.
 */
@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly slots: SlotRepository,
    private readonly pricing: PricingService,
    private readonly gate: HoldGate,
    private readonly idempotency: IdempotencyLock,
    private readonly payments: PaymentGateway,
    private readonly outbox: OutboxWriter,
    private readonly changes: SlotChangePublisher,
    @Inject(HOLD_RULES) private readonly rules: BookingRule,
  ) {}

  async hold(slotId: string, userId: string, opts: HoldOptions = {}): Promise<HoldView> {
    const useGate = opts.useGate ?? true;

    // Layer 1: Redis gate FIRST, so a crowd is rejected in Redis without touching Postgres.
    if (useGate && (await this.gate.tryAcquire(slotId, userId, appConfig.holdTtlMs)) === 'TAKEN') {
      throw new HoldContestedError();
    }
    try {
      return await this.holdInDatabase(slotId, userId);
    } catch (e) {
      // We passed the gate but didn't get the slot: free the gate for the next buyer.
      if (useGate) await this.gate.release(slotId, userId);
      throw e;
    }
  }

  private async holdInDatabase(slotId: string, userId: string): Promise<HoldView> {
    const now = new Date();
    const slot = await this.slots.findById(slotId);
    if (!slot) throw new NotFoundError('Slot');
    const state = SlotStateResolver.resolve(slot, now);

    // Re-clicking "Book" while already holding just returns the existing hold.
    if (state.isHeldBy(userId)) return this.toHoldView(slotId, slot.heldPrice!, slot.holdExpiresAt!);

    await this.rules.check({ slot, state, userId, now });

    // Price is locked at the moment of the hold: it can't drop or rise during checkout.
    const price = this.pricing.priceAt(slot, now);
    const expiresAt = new Date(now.getTime() + appConfig.holdTtlMs);

    // Layer 2: optimistic-lock compare-and-set in Postgres (authoritative).
    const won = await this.slots.tryHold({ slotId, expectedVersion: slot.version, userId, price, expiresAt, now });
    if (!won) throw new SlotUnavailableError('Someone grabbed this slot a split second before you');

    await this.changes.slotChanged(slotId);
    return this.toHoldView(slotId, price, expiresAt);
  }

  async release(slotId: string, userId: string): Promise<void> {
    const released = await this.slots.releaseHold(slotId, userId);
    await this.gate.release(slotId, userId);
    if (released) await this.changes.slotChanged(slotId);
  }

  async checkout(slotId: string, userId: string, idempotencyKey: string | undefined, method: PaymentMethod): Promise<BookingView> {
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
      throw new ValidationError('An Idempotency-Key header (8-100 chars) is required');
    }
    const scopedKey = `${userId}:${idempotencyKey}`;

    // Replay: this exact request already succeeded, return the same booking (no double charge).
    const existing = await this.findByIdempotencyKey(scopedKey);
    if (existing) return this.toBookingView(existing);

    if (!(await this.idempotency.begin(scopedKey))) {
      throw new ConflictError('This payment is already being processed', 'DUPLICATE_REQUEST');
    }
    try {
      return await this.performCheckout(slotId, userId, scopedKey, method);
    } finally {
      await this.idempotency.end(scopedKey);
    }
  }

  async myBookings(userId: string): Promise<BookingView[]> {
    const rows = await this.prisma.booking.findMany({
      where: { userId },
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((b) => this.toBookingView(b));
  }

  private async performCheckout(slotId: string, userId: string, scopedKey: string, method: PaymentMethod): Promise<BookingView> {
    const slot = await this.slots.findById(slotId);
    if (!slot) throw new NotFoundError('Slot');
    const state = SlotStateResolver.resolve(slot, new Date());
    if (!state.canConfirm(userId)) {
      if (slot.holdUserId === userId && slot.status === 'HELD') throw new HoldExpiredError();
      if (state.status === 'SOLD') throw new SlotUnavailableError('This slot has already been sold');
      throw new SlotUnavailableError('Your hold on this slot is no longer active');
    }
    const price = slot.heldPrice!;

    const payment = await this.payments.charge({
      amount: price,
      method,
      reference: scopedKey,
      description: `${slot.title} @ ${slot.business.name}`,
    });

    let booking: BookingRecord;
    try {
      booking = await this.prisma.$transaction(async (tx) => {
        // Layer 2 again: still HELD by me, same version, not expired (payment took time).
        const sold = await this.slots.tryMarkSold(tx, { slotId, expectedVersion: slot.version, userId, price, now: new Date() });
        if (!sold) throw new HoldExpiredError();
        // Layer 3: UNIQUE(slotId) makes a second booking row physically impossible.
        const created = await tx.booking.create({
          data: {
            slotId,
            userId,
            pricePaid: price,
            originalPrice: slot.basePrice,
            paymentRef: payment.paymentRef,
            paymentMethod: method,
            idempotencyKey: scopedKey,
          },
          include: bookingInclude,
        });
        await this.outbox.add(tx, {
          type: 'SLOT_SOLD',
          payload: {
            slotId,
            bookingId: created.id,
            title: slot.title,
            businessName: slot.business.name,
            buyerId: userId,
            merchantUserId: slot.business.ownerId,
            pricePaid: price,
            basePrice: slot.basePrice,
            startsAt: slot.startsAt.toISOString(),
          },
        });
        return created;
      });
    } catch (e) {
      // A concurrent duplicate of THIS request (same idempotency key) may have already
      // turned this same payment into a booking. Return it instead of refunding.
      const duplicate = await this.findByIdempotencyKey(scopedKey);
      if (duplicate && duplicate.paymentRef === payment.paymentRef) return this.toBookingView(duplicate);
      // Compensating action: the charge succeeded but the sale didn't, so give the money back.
      await this.payments.refund(payment.paymentRef).catch((err) => this.logger.error(`Refund failed for ${payment.paymentRef}: ${err}`));
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new SlotUnavailableError('This slot has already been sold');
      }
      throw e;
    }

    await this.gate.release(slotId, userId);
    await this.changes.slotChanged(slotId);
    return this.toBookingView(booking);
  }

  private findByIdempotencyKey(key: string): Promise<BookingRecord | null> {
    return this.prisma.booking.findUnique({ where: { idempotencyKey: key }, include: bookingInclude });
  }

  private toHoldView(slotId: string, price: number, expiresAt: Date): HoldView {
    return { slotId, price, expiresAt: expiresAt.toISOString() };
  }

  private toBookingView(b: BookingRecord): BookingView {
    return {
      id: b.id,
      code: `FS-${b.id.slice(-6).toUpperCase()}`,
      slotId: b.slotId,
      title: b.slot.title,
      businessName: b.slot.business.name,
      address: `${b.slot.business.address}, ${b.slot.business.city}`,
      startsAt: b.slot.startsAt.toISOString(),
      durationMin: b.slot.durationMin,
      pricePaid: b.pricePaid,
      originalPrice: b.originalPrice,
      paymentRef: b.paymentRef,
      paymentMethod: b.paymentMethod,
      createdAt: b.createdAt.toISOString(),
    };
  }
}
