import { Body, Controller, Get, HttpCode, Injectable, Module, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { appConfig } from '../../common/config/app-config';
import { DomainError } from '../../common/errors/domain-errors';
import { LeaderElectionService } from '../../infrastructure/coordination/leader-election.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Auth } from '../auth/guards';
import { BookingModule } from '../booking/booking.module';
import { BookingService } from '../booking/booking.service';
import { SlotChangePublisher } from '../slots/slot-change.publisher';
import { SlotRepository } from '../slots/slot.repository';
import { SlotsModule } from '../slots/slots.module';
import { BUSINESSES, DEAL_TEMPLATES } from './deal-catalog';
import { buildLiveDeal } from './deal-factory';

export type StampedeMode = 'safe' | 'db-only' | 'naive';
export type Outcome = 'WON' | 'REJECTED_GATE' | 'REJECTED_STATE' | 'REJECTED_DB' | 'ERROR';

export class StampedeDto {
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(1000)
  buyers: number;

  @IsIn(['safe', 'db-only', 'naive'])
  mode: StampedeMode;
}

const ARENA_EMAIL = 'arena@bots.flashslot.dev';
const botEmail = (i: number) => `bot-${String(i).padStart(4, '0')}@bots.flashslot.dev`;

/**
 * CONCURRENCY LAB: fires N simultaneous buyers at one brand-new slot.
 *   safe     = Redis gate + DB optimistic lock (production path)
 *   db-only  = DB optimistic lock only (proves the DB alone guarantees one winner)
 *   naive    = read-then-write with no lock (shows the double-selling bug we prevent)
 */
@Injectable()
export class StampedeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingService,
    private readonly repo: SlotRepository,
    private readonly changes: SlotChangePublisher,
  ) {}

  async run(buyers: number, mode: StampedeMode) {
    const [businessId, botIds] = await Promise.all([this.ensureArena(), this.ensureBots(buyers)]);
    const now = new Date();
    const slot = await this.repo.create({
      businessId,
      category: 'ENTERTAINMENT',
      title: `Stampede test #${Math.floor(Math.random() * 9000 + 1000)}`,
      description: 'Concurrency lab test slot',
      startsAt: new Date(now.getTime() + 60 * 60_000),
      durationMin: 60,
      basePrice: 99_900,
      floorPrice: 19_900,
      strategy: 'LINEAR',
      status: 'LIVE',
      liveAt: now,
      isDemo: true,
    });

    const startedAt = performance.now();
    const attempts = await Promise.all(
      botIds.map(async (botId, i) => {
        const t = performance.now();
        let outcome: Outcome;
        try {
          if (mode === 'naive') {
            outcome = (await this.repo.naiveHold(slot.id, botId, 5 + Math.random() * 25)) ? 'WON' : 'REJECTED_STATE';
          } else {
            await this.bookings.hold(slot.id, botId, { useGate: mode === 'safe' });
            outcome = 'WON';
          }
        } catch (e) {
          outcome = classify(e);
        }
        return { buyer: i + 1, botId, outcome, ms: Math.round((performance.now() - t) * 10) / 10 };
      }),
    );
    const totalMs = Math.round(performance.now() - startedAt);

    const winners = attempts.filter((a) => a.outcome === 'WON');
    let booking: { code: string; pricePaid: number } | null = null;
    if (mode === 'naive') {
      await this.prisma.slot.update({ where: { id: slot.id }, data: { status: 'CANCELLED' } });
    } else if (winners.length === 1) {
      const b = await this.bookings.checkout(slot.id, winners[0].botId, randomUUID(), 'UPI');
      booking = { code: b.code, pricePaid: b.pricePaid };
    }
    await this.changes.slotChanged(slot.id);

    const final = await this.prisma.slot.findUniqueOrThrow({ where: { id: slot.id }, select: { status: true } });
    const bookingsForSlot = await this.prisma.booking.count({ where: { slotId: slot.id } });
    const latencies = attempts.map((a) => a.ms).sort((a, b) => a - b);
    const count = (o: Outcome) => attempts.filter((a) => a.outcome === o).length;

    return {
      mode,
      buyers,
      slotId: slot.id,
      servedBy: appConfig.instanceId,
      totalMs,
      winners: winners.length,
      breakdown: {
        won: winners.length,
        rejectedGate: count('REJECTED_GATE'),
        rejectedState: count('REJECTED_STATE'),
        rejectedDb: count('REJECTED_DB'),
        errors: count('ERROR'),
      },
      latency: { p50: pct(latencies, 0.5), p95: pct(latencies, 0.95), max: latencies.at(-1) ?? 0 },
      finalStatus: final.status,
      bookingsForSlot,
      booking,
      attempts: attempts.map(({ buyer, outcome, ms }) => ({ buyer, outcome, ms })),
    };
  }

  async spawnDeals(count = 8) {
    const owners = await this.prisma.user.findMany({
      where: { email: { in: BUSINESSES.map((b) => b.ownerEmail) } },
      include: { business: true },
    });
    const byEmail = new Map(owners.filter((o) => o.business).map((o) => [o.email, o.business!]));
    const now = new Date();
    const templates = [...DEAL_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, count);
    const ids: string[] = [];
    for (const t of templates) {
      const seed = BUSINESSES.find((b) => b.key === t.businessKey)!;
      const business = byEmail.get(seed.ownerEmail);
      if (!business) continue;
      const slot = await this.repo.create(buildLiveDeal(t, business.id, business.category, now));
      ids.push(slot.id);
    }
    await this.changes.slotsChanged(ids);
    return { created: ids.length };
  }

  private async ensureArena(): Promise<string> {
    const owner = await this.prisma.user.upsert({
      where: { email: ARENA_EMAIL },
      create: { email: ARENA_EMAIL, name: 'Stampede Arena', passwordHash: '!', role: 'MERCHANT', isBot: true },
      update: {},
    });
    const biz = await this.prisma.business.upsert({
      where: { ownerId: owner.id },
      create: { ownerId: owner.id, name: 'Stampede Arena', category: 'ENTERTAINMENT', city: 'Lab', address: 'In-memory', description: 'Demo', isDemo: true },
      update: {},
    });
    return biz.id;
  }

  private async ensureBots(n: number): Promise<string[]> {
    const emails = Array.from({ length: n }, (_, i) => botEmail(i + 1));
    await this.prisma.user.createMany({
      data: emails.map((email, i) => ({ email, name: `Bot ${i + 1}`, passwordHash: '!', role: 'CUSTOMER' as const, isBot: true })),
      skipDuplicates: true,
    });
    const bots = await this.prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } });
    const byEmail = new Map(bots.map((b) => [b.email, b.id]));
    return emails.map((e) => byEmail.get(e)!);
  }
}

function classify(e: unknown): Outcome {
  if (!(e instanceof DomainError)) return 'ERROR';
  switch (e.code) {
    case 'HOLD_CONTESTED':
      return 'REJECTED_GATE';
    case 'SLOT_HELD':
      return 'REJECTED_STATE';
    case 'SLOT_UNAVAILABLE':
      return 'REJECTED_DB';
    default:
      return 'ERROR';
  }
}

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

@Auth('ADMIN')
@Controller('demo')
export class DemoController {
  constructor(
    private readonly stampede: StampedeService,
    private readonly leader: LeaderElectionService,
  ) {}

  @Post('stampede')
  @HttpCode(200)
  run(@Body() dto: StampedeDto) {
    return this.stampede.run(dto.buyers, dto.mode);
  }

  @Post('spawn-deals')
  @HttpCode(200)
  spawn() {
    return this.stampede.spawnDeals();
  }

  @Get('system')
  system() {
    return { instance: appConfig.instanceId, isLeader: this.leader.isLeader, holdTtlSeconds: appConfig.holdTtlMs / 1000 };
  }
}

@Module({
  imports: [BookingModule, SlotsModule],
  controllers: [DemoController],
  providers: [StampedeService],
})
export class DemoModule {}
