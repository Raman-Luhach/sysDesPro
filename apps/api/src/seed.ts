/**
 * Resets the database to a fresh demo state.
 *   npm run seed            (local)
 *   npm run stack:seed      (docker full stack)
 * Every account's password is: password123
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import { BUSINESSES, DEAL_TEMPLATES } from './modules/demo/deal-catalog';
import { buildLiveDeal } from './modules/demo/deal-factory';

const prisma = new PrismaClient();
const PASSWORD = 'password123';
const MIN = 60_000;

async function main() {
  const now = new Date();
  console.log('Clearing old data...');
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.outboxEvent.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.slot.deleteMany(),
    prisma.business.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const customer = await prisma.user.create({ data: { email: 'customer@flashslot.dev', name: 'Riya Sharma', passwordHash, role: 'CUSTOMER' } });
  await prisma.user.create({ data: { email: 'customer2@flashslot.dev', name: 'Dev Patel', passwordHash, role: 'CUSTOMER' } });
  await prisma.user.create({ data: { email: 'admin@flashslot.dev', name: 'Lab Admin', passwordHash, role: 'ADMIN' } });

  const businesses = new Map<string, { id: string; category: (typeof BUSINESSES)[number]['category'] }>();
  for (const b of BUSINESSES) {
    const owner = await prisma.user.create({ data: { email: b.ownerEmail, name: b.ownerName, passwordHash, role: 'MERCHANT' } });
    const biz = await prisma.business.create({
      data: { ownerId: owner.id, name: b.name, category: b.category, city: b.city, address: b.address, description: b.description },
    });
    businesses.set(b.key, { id: biz.id, category: biz.category });
  }

  console.log('Creating live deals...');
  for (const t of DEAL_TEMPLATES) {
    const biz = businesses.get(t.businessKey)!;
    await prisma.slot.create({ data: buildLiveDeal(t, biz.id, biz.category, now) });
  }

  // A little history so the merchant dashboard has numbers on day one.
  console.log('Creating sales history...');
  const glow = businesses.get('glow')!;
  const history = [
    { title: 'Keratin Treatment', base: 450000, sold: 279900, daysAgo: 1 },
    { title: 'Signature Haircut & Blow-dry', base: 180000, sold: 109900, daysAgo: 2 },
    { title: 'Hydra Facial', base: 350000, sold: 199900, daysAgo: 3 },
  ];
  for (const [i, h] of history.entries()) {
    const startsAt = new Date(now.getTime() - h.daysAgo * 24 * 60 * MIN);
    const slot = await prisma.slot.create({
      data: {
        businessId: glow.id,
        category: glow.category,
        title: h.title,
        description: 'Past flash sale',
        startsAt,
        durationMin: 60,
        basePrice: h.base,
        floorPrice: Math.round(h.base * 0.4),
        strategy: 'LINEAR',
        status: 'SOLD',
        liveAt: new Date(startsAt.getTime() - 180 * MIN),
        soldPrice: h.sold,
        soldAt: new Date(startsAt.getTime() - 40 * MIN),
        holdUserId: customer.id,
        version: 2,
      },
    });
    await prisma.booking.create({
      data: {
        slotId: slot.id,
        userId: customer.id,
        pricePaid: h.sold,
        originalPrice: h.base,
        paymentRef: `pay_seed${i}`,
        paymentMethod: 'UPI',
        idempotencyKey: `seed-${i}`,
        createdAt: new Date(startsAt.getTime() - 40 * MIN),
      },
    });
  }
  await prisma.slot.create({
    data: {
      businessId: glow.id,
      category: glow.category,
      title: 'Bridal Trial Makeup',
      description: 'Past flash sale',
      startsAt: new Date(now.getTime() - 2 * 24 * 60 * MIN),
      durationMin: 90,
      basePrice: 500000,
      floorPrice: 250000,
      strategy: 'LINEAR',
      status: 'EXPIRED',
      liveAt: new Date(now.getTime() - 2 * 24 * 60 * MIN - 120 * MIN),
    },
  });

  // Clear cached feeds, holds and counters so Redis matches the fresh DB.
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380');
  const keys = await redis.keys('flashslot:*');
  const keep = new Set(['flashslot:leader', 'flashslot:viewer-instances']);
  const toDelete = keys.filter((k) => !keep.has(k) && !k.startsWith('flashslot:viewers:'));
  if (toDelete.length) await redis.del(...toDelete);
  await redis.quit();

  console.log(`
Seed complete. Every password is "${PASSWORD}"
  Customer : customer@flashslot.dev
  Merchant : merchant@flashslot.dev   (Glow Studio)
  Admin    : admin@flashslot.dev      (Concurrency Lab)
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
