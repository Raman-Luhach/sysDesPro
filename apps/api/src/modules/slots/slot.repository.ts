import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { FeedFilter, SlotRecord } from './slot.types';

export interface HoldAttempt {
  slotId: string;
  expectedVersion: number;
  userId: string;
  price: number;
  expiresAt: Date;
  now: Date;
}

export interface SaleAttempt {
  slotId: string;
  expectedVersion: number;
  userId: string;
  price: number;
  now: Date;
}

/**
 * Prisma stores DateTime as `timestamp WITHOUT time zone` holding UTC. In raw SQL we must
 * convert explicitly, otherwise Postgres applies the server's TimeZone (e.g. IST +5:30) and
 * every comparison is off by hours. This makes the queries correct on any server timezone.
 */
function utc(d: Date): string {
  return d.toISOString();
}

/**
 * REPOSITORY pattern: the only place that knows how slots are stored.
 *
 * Every state transition is a single conditional UPDATE (compare-and-set):
 *   UPDATE ... WHERE id = ? AND version = ? AND status = <expected>
 * Postgres locks the row while updating and re-checks the WHERE clause, so if 1,000
 * requests race, exactly one sees "1 row updated" and every other sees 0. This is
 * OPTIMISTIC LOCKING and it is the final, authoritative guarantee against double-selling.
 */
@Injectable()
export class SlotRepository {
  private static readonly include = { business: true } as const;

  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<SlotRecord | null> {
    return this.prisma.slot.findUnique({ where: { id }, include: SlotRepository.include });
  }

  findManyByIds(ids: string[]): Promise<SlotRecord[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.prisma.slot.findMany({ where: { id: { in: ids } }, include: SlotRepository.include });
  }

  create(data: Prisma.SlotUncheckedCreateInput): Promise<SlotRecord> {
    return this.prisma.slot.create({ data, include: SlotRepository.include });
  }

  /** Slots a buyer can see in the feed: on sale, not started, not demo data. */
  listOnSale(filter: FeedFilter, now: Date): Promise<SlotRecord[]> {
    return this.prisma.slot.findMany({
      where: {
        status: { in: ['LIVE', 'HELD'] },
        startsAt: { gt: now },
        isDemo: false,
        ...(filter.category ? { category: filter.category } : {}),
        ...(filter.city ? { business: { city: { equals: filter.city, mode: 'insensitive' } } } : {}),
      },
      include: SlotRepository.include,
      orderBy: { startsAt: 'asc' },
      take: 200,
    });
  }

  listByBusiness(businessId: string): Promise<SlotRecord[]> {
    return this.prisma.slot.findMany({
      where: { businessId },
      include: SlotRepository.include,
      orderBy: [{ startsAt: 'desc' }],
      take: 200,
    });
  }

  /** LIVE -> HELD (or take over an expired hold). Returns true only for the single winner. */
  async tryHold(a: HoldAttempt): Promise<boolean> {
    const { count } = await this.prisma.slot.updateMany({
      where: {
        id: a.slotId,
        version: a.expectedVersion,
        startsAt: { gt: a.now },
        OR: [{ status: 'LIVE' }, { status: 'HELD', holdExpiresAt: { lte: a.now } }],
      },
      data: {
        status: 'HELD',
        holdUserId: a.userId,
        holdExpiresAt: a.expiresAt,
        heldPrice: a.price,
        version: { increment: 1 },
      },
    });
    return count === 1;
  }

  /** HELD (by this user, not expired) -> SOLD. Must run inside the booking transaction. */
  async tryMarkSold(tx: Prisma.TransactionClient, a: SaleAttempt): Promise<boolean> {
    const { count } = await tx.slot.updateMany({
      where: {
        id: a.slotId,
        version: a.expectedVersion,
        status: 'HELD',
        holdUserId: a.userId,
        holdExpiresAt: { gt: a.now },
      },
      data: {
        status: 'SOLD',
        soldPrice: a.price,
        soldAt: a.now,
        holdExpiresAt: null,
        version: { increment: 1 },
      },
    });
    return count === 1;
  }

  /** Buyer abandons checkout: HELD -> LIVE. */
  async releaseHold(slotId: string, userId: string): Promise<boolean> {
    const { count } = await this.prisma.slot.updateMany({
      where: { id: slotId, status: 'HELD', holdUserId: userId },
      data: { status: 'LIVE', holdUserId: null, holdExpiresAt: null, heldPrice: null, version: { increment: 1 } },
    });
    return count === 1;
  }

  async publish(slotId: string, expectedVersion: number, now: Date): Promise<boolean> {
    const { count } = await this.prisma.slot.updateMany({
      where: { id: slotId, version: expectedVersion, status: 'DRAFT', startsAt: { gt: now } },
      data: { status: 'LIVE', liveAt: now, version: { increment: 1 } },
    });
    return count === 1;
  }

  async cancel(slotId: string, expectedVersion: number): Promise<boolean> {
    const { count } = await this.prisma.slot.updateMany({
      where: { id: slotId, version: expectedVersion, status: { in: ['DRAFT', 'LIVE'] } },
      data: { status: 'CANCELLED', version: { increment: 1 } },
    });
    return count === 1;
  }

  /** Sweeper: revert holds whose timer ran out. Atomic UPDATE ... RETURNING. */
  async revertExpiredHolds(now: Date): Promise<string[]> {
    const t = utc(now);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "Slot"
         SET status = 'LIVE', "holdUserId" = NULL, "holdExpiresAt" = NULL, "heldPrice" = NULL,
             version = version + 1, "updatedAt" = ${t}::timestamptz AT TIME ZONE 'UTC'
       WHERE status = 'HELD'
         AND "holdExpiresAt" <= ${t}::timestamptz AT TIME ZONE 'UTC'
         AND "startsAt" > ${t}::timestamptz AT TIME ZONE 'UTC'
   RETURNING id`;
    return rows.map((r) => r.id);
  }

  /** Sweeper: slots whose start time passed unsold become EXPIRED. */
  async expireStarted(now: Date): Promise<Array<{ id: string; title: string; ownerId: string; isDemo: boolean }>> {
    const t = utc(now);
    return this.prisma.$queryRaw`
      UPDATE "Slot" s
         SET status = 'EXPIRED', "holdUserId" = NULL, "holdExpiresAt" = NULL, "heldPrice" = NULL,
             version = s.version + 1, "updatedAt" = ${t}::timestamptz AT TIME ZONE 'UTC'
        FROM "Business" b
       WHERE b.id = s."businessId" AND s.status IN ('DRAFT', 'LIVE', 'HELD')
         AND s."startsAt" <= ${t}::timestamptz AT TIME ZONE 'UTC'
   RETURNING s.id, s.title, b."ownerId" AS "ownerId", s."isDemo" AS "isDemo"`;
  }

  /**
   * DELIBERATELY BROKEN read-then-write, used only by the Concurrency Lab to show what
   * happens without a conditional update: every racer reads LIVE and every racer "wins".
   */
  async naiveHold(slotId: string, userId: string, thinkTimeMs: number): Promise<boolean> {
    const slot = await this.prisma.slot.findUnique({ where: { id: slotId }, select: { status: true } });
    if (slot?.status !== 'LIVE') return false; // "check" ...
    // ... a gap where other requests read the same stale LIVE status ...
    await new Promise((r) => setTimeout(r, thinkTimeMs));
    await this.prisma.slot.update({ where: { id: slotId }, data: { status: 'HELD', holdUserId: userId } });
    return true;
  }
}
