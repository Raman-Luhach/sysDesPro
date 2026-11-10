import { Injectable, OnModuleInit } from '@nestjs/common';
import { formatInr } from '../../common/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EventBus } from '../events/event-bus';
import { RealtimePublisher } from '../realtime/realtime.publisher';

interface NewNotification {
  userId: string;
  title: string;
  body: string;
  link?: string;
}

/** Observer of domain events: turns facts into in-app notifications (stored + pushed live). */
@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly realtime: RealtimePublisher,
  ) {}

  onModuleInit(): void {
    this.bus.subscribe('SLOT_SOLD', async ({ payload: p }) => {
      const saved = p.basePrice - p.pricePaid;
      await this.notifyMany([
        {
          userId: p.buyerId,
          title: 'Booking confirmed 🎉',
          body: `${p.title} at ${p.businessName} for ${formatInr(p.pricePaid)}${saved > 0 ? ` (you saved ${formatInr(saved)})` : ''}.`,
          link: '/bookings',
        },
        {
          userId: p.merchantUserId,
          title: 'Slot sold 💸',
          body: `"${p.title}" sold for ${formatInr(p.pricePaid)}. An empty slot just became revenue.`,
          link: '/merchant',
        },
      ]);
    });

    this.bus.subscribe('SLOT_EXPIRED', async ({ payload: p }) => {
      await this.notifyMany([
        {
          userId: p.merchantUserId,
          title: 'Slot went unsold',
          body: `"${p.title}" started without a buyer. Try a lower floor price or a steeper curve next time.`,
          link: '/merchant',
        },
      ]);
    });
  }

  list(userId: string) {
    return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }

  private async notifyMany(items: NewNotification[]): Promise<void> {
    for (const n of items) {
      const created = await this.prisma.notification.create({ data: n });
      this.realtime.toUser(n.userId, 'notification', created);
    }
  }
}
