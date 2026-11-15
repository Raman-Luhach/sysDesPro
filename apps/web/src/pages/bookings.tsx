import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarClock, MapPin, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, EmptyState, Skeleton } from '../components/ui';
import { api } from '../lib/api';
import { duration, inr, when } from '../lib/format';

export function BookingsPage() {
  const q = useQuery({ queryKey: ['bookings'], queryFn: api.myBookings });
  const upcoming = (q.data ?? []).filter((b) => new Date(b.startsAt).getTime() > Date.now());
  const past = (q.data ?? []).filter((b) => new Date(b.startsAt).getTime() <= Date.now());
  const totalSaved = (q.data ?? []).reduce((s, b) => s + Math.max(0, b.originalPrice - b.pricePaid), 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">My bookings</h1>
          <p className="mt-1 text-muted">Show your booking code at the venue.</p>
        </div>
        {totalSaved > 0 && (
          <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-right">
            <div className="text-xs font-medium text-success">Total saved with FlashSlot</div>
            <div className="font-display text-2xl font-bold text-success">{inr(totalSaved)}</div>
          </div>
        )}
      </div>

      {q.isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : !q.data?.length ? (
        <EmptyState
          icon={<Ticket className="size-6" />}
          title="No bookings yet"
          body="Grab a falling-price deal and it shows up here."
          action={
            <Link to="/">
              <Button>Browse live deals</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {[
            { title: 'Upcoming', items: upcoming },
            { title: 'Past', items: past },
          ]
            .filter((g) => g.items.length)
            .map((g) => (
              <section key={g.title}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{g.title}</h2>
                <div className="space-y-4">
                  {g.items.map((b, i) => (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card sm:flex-row"
                    >
                      <div className="flex-1 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-display text-lg font-semibold">{b.title}</h3>
                            <div className="text-sm text-muted">{b.businessName}</div>
                          </div>
                          {b.originalPrice > b.pricePaid && <Badge tone="success">Saved {inr(b.originalPrice - b.pricePaid)}</Badge>}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
                          <span className="flex items-center gap-1.5">
                            <CalendarClock className="size-4" />
                            {when(b.startsAt)} · {duration(b.durationMin)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin className="size-4" />
                            {b.address}
                          </span>
                        </div>
                      </div>
                      <div className="relative flex items-center justify-between gap-4 border-t border-dashed border-border bg-surface-2 p-5 sm:w-52 sm:flex-col sm:items-start sm:justify-center sm:border-l sm:border-t-0">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">Code</div>
                          <div className="font-mono text-lg font-bold tracking-wider">{b.code}</div>
                        </div>
                        <div className="text-right sm:text-left">
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">Paid · {b.paymentMethod}</div>
                          <div className="font-display text-lg font-bold">{inr(b.pricePaid)}</div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
