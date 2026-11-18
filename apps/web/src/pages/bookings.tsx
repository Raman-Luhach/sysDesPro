import { useQuery } from '@tanstack/react-query';
import { CalendarClock, MapPin, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CountUp, Eyebrow, Reveal } from '../components/kit';
import { Badge, Button, EmptyState, Skeleton } from '../components/ui';
import { api } from '../lib/api';
import { cn, duration, inr, when } from '../lib/format';
import type { Booking } from '../lib/types';

export function BookingsPage() {
  const q = useQuery({ queryKey: ['bookings'], queryFn: api.myBookings });
  const upcoming = (q.data ?? []).filter((b) => new Date(b.startsAt).getTime() > Date.now());
  const past = (q.data ?? []).filter((b) => new Date(b.startsAt).getTime() <= Date.now());
  const totalSaved = (q.data ?? []).reduce((s, b) => s + Math.max(0, b.originalPrice - b.pricePaid), 0);

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <header className="mb-14 flex flex-wrap items-end justify-between gap-x-8 gap-y-8">
        <div>
          <Eyebrow>Your tickets</Eyebrow>
          <h1 className="mt-4 font-display text-4xl font-medium leading-[1] tracking-[-0.04em] sm:text-5xl">
            My <span className="font-serif italic">bookings</span>
          </h1>
          <p className="mt-3 text-[15px] text-muted">Show your booking code at the venue.</p>
        </div>
        {totalSaved > 0 && (
          <div className="sm:text-right">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Total saved</div>
            <CountUp to={totalSaved} format={inr} className="mt-2 block font-display text-5xl font-medium leading-none tracking-[-0.045em] text-success" />
          </div>
        )}
      </header>

      {q.isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      ) : !q.data?.length ? (
        <EmptyState
          icon={<Ticket className="size-6" />}
          title="No bookings yet"
          body="Grab a falling-price deal and it shows up here."
          action={
            <Link to="/">
              <Button arrow>Browse live deals</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-14">
          {[
            { title: 'Upcoming', items: upcoming, past: false },
            { title: 'Past', items: past, past: true },
          ]
            .filter((g) => g.items.length)
            .map((g) => (
              <section key={g.title}>
                <Eyebrow className="mb-5">
                  {g.title}
                  <span className="font-mono tracking-normal">· {g.items.length}</span>
                </Eyebrow>
                <div className="space-y-4">
                  {g.items.map((b, i) => (
                    <Reveal key={b.id} delay={Math.min(i, 6) * 0.06}>
                      <BookingTicket booking={b} past={g.past} />
                    </Reveal>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}

/*
 * Perforation notches: each half of the ticket masks a quarter circle out of the two corners on the seam,
 * so together they cut a real half-circle hole (true transparency, works over any background and on
 * faded past tickets). Seam is horizontal on mobile, vertical from sm up.
 */
const MAIN_NOTCHES =
  '[mask-composite:intersect] [mask-image:radial-gradient(circle_12px_at_0_100%,transparent_11.5px,black_12px),radial-gradient(circle_12px_at_100%_100%,transparent_11.5px,black_12px)] sm:[mask-image:radial-gradient(circle_12px_at_100%_0,transparent_11.5px,black_12px),radial-gradient(circle_12px_at_100%_100%,transparent_11.5px,black_12px)]';
const STUB_NOTCHES =
  '[mask-composite:intersect] [mask-image:radial-gradient(circle_12px_at_0_0,transparent_11.5px,black_12px),radial-gradient(circle_12px_at_100%_0,transparent_11.5px,black_12px)] sm:[mask-image:radial-gradient(circle_12px_at_0_0,transparent_11.5px,black_12px),radial-gradient(circle_12px_at_0_100%,transparent_11.5px,black_12px)]';

/** A ticket: details on the left, a perforated stub with the code on the right (bottom on mobile). */
function BookingTicket({ booking: b, past }: { booking: Booking; past: boolean }) {
  const saved = b.originalPrice - b.pricePaid;
  return (
    <article className={cn('flex flex-col sm:flex-row', past && 'opacity-60 grayscale-[0.7]')}>
      <div className={cn('min-w-0 flex-1 rounded-t-3xl bg-surface p-6 sm:rounded-l-3xl sm:rounded-tr-none sm:p-7', MAIN_NOTCHES)}>
        <h3 className="font-display text-xl font-medium leading-tight tracking-[-0.03em]">{b.title}</h3>
        <div className="mt-1 text-sm text-muted">{b.businessName}</div>
        <div className="mt-5 space-y-2 text-sm text-muted">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 shrink-0" />
            <span>
              {when(b.startsAt)} · {duration(b.durationMin)}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">{b.address}</span>
          </div>
        </div>
        {saved > 0 && (
          <Badge tone="success" className="mt-5">
            Saved {inr(saved)}
          </Badge>
        )}
      </div>

      {/* Stub, behind a dashed perforation. */}
      <div
        className={cn(
          'flex shrink-0 items-end justify-between gap-4 rounded-b-3xl border-t border-dashed border-border bg-surface p-6 sm:w-60 sm:flex-col sm:items-start sm:justify-center sm:gap-6 sm:rounded-r-3xl sm:rounded-bl-none sm:border-l sm:border-t-0 sm:p-7',
          STUB_NOTCHES,
        )}
      >
        <div className="min-w-0">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">Code</div>
          <div className="mt-1.5 font-mono text-2xl font-medium tracking-[0.18em]">{b.code}</div>
        </div>
        <div className="text-right sm:text-left">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">Paid · {b.paymentMethod}</div>
          <div className="mt-1.5 font-display text-xl font-medium tabular-nums tracking-[-0.03em]">{inr(b.pricePaid)}</div>
        </div>
      </div>
    </article>
  );
}
