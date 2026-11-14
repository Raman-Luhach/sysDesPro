import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, Clock, Eye, Info, Lock, MapPin, Sparkles, TrendingDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CategoryArt, CATEGORY_META, STRATEGY_META } from '../components/category';
import { CheckoutModal } from '../components/checkout-modal';
import { AnimatedPrice } from '../components/animated-price';
import { PriceChart } from '../components/price-chart';
import { Badge, Button, Card, EmptyState, Skeleton } from '../components/ui';
import { useAuth } from '../context/auth';
import { useRealtime } from '../context/realtime';
import { api, ApiError } from '../lib/api';
import { cn, countdown, duration, inr, when } from '../lib/format';
import { useLivePrice, useLiveViewers, useNow } from '../lib/live-store';
import type { Hold, Slot } from '../lib/types';

export function DealPage() {
  const { id = '' } = useParams();
  const { watch } = useRealtime();
  const q = useQuery({ queryKey: ['slot', id], queryFn: () => api.slot(id), refetchInterval: 15_000 });

  useEffect(() => watch(id), [id, watch]);

  if (q.isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-3xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <EmptyState
        icon={<Info className="size-6" />}
        title="Deal not found"
        body="It may have been removed by the business."
        action={
          <Link to="/">
            <Button>Back to live deals</Button>
          </Link>
        }
      />
    );
  }
  return <DealView slot={q.data.slot} curve={q.data.curve} />;
}

function DealView({ slot, curve }: { slot: Slot; curve: { at: string; price: number }[] }) {
  const price = useLivePrice(slot.id, slot.currentPrice);
  const viewers = useLiveViewers(slot.id, slot.viewers);
  const now = useNow();
  const meta = CATEGORY_META[slot.category];
  // This page is itself watching the slot, so exclude ourselves from the count.
  const others = Math.max(0, viewers - 1);
  const msLeft = new Date(slot.startsAt).getTime() - now;
  const nextDropMs = slot.nextDropAt ? new Date(slot.nextDropAt).getTime() - now : null;
  const strategyText: Record<Slot['strategy'], string> = {
    LINEAR: 'The price falls steadily every second until the slot starts.',
    STEP: `The price drops in ${slot.strategyParams.steps ?? 6} equal steps before the slot starts.`,
    EXPONENTIAL: 'The price stays high at first, then falls faster and faster as the start time gets closer.',
  };

  return (
    <div>
      <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> All deals
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <Card className="min-w-0 overflow-hidden lg:col-start-1">
            <CategoryArt category={slot.category} className="h-40 sm:h-48" iconSize="size-44" />
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{meta.label}</Badge>
                <Badge>{STRATEGY_META[slot.strategy].label}</Badge>
                {others > 0 && (
                  <Badge tone="brand">
                    <Eye className="size-3" /> {others} {others === 1 ? 'other person' : 'others'} viewing now
                  </Badge>
                )}
              </div>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">{slot.title}</h1>
              <div className="mt-2 text-muted">
                <span className="font-semibold text-fg">{slot.business.name}</span>
                <span className="mx-2">·</span>
                <MapPin className="mr-1 inline size-4" />
                {slot.business.address}, {slot.business.city}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Fact icon={<CalendarClock className="size-4" />} label="Starts" value={when(slot.startsAt)} />
                <Fact icon={<Clock className="size-4" />} label="Duration" value={duration(slot.durationMin)} />
                <Fact icon={<TrendingDown className="size-4" />} label="Can drop to" value={inr(slot.floorPrice)} />
              </div>
              {slot.description && <p className="mt-5 leading-relaxed text-muted">{slot.description}</p>}
            </div>
          </Card>

        <div className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <PurchaseCard slot={slot} price={price} msLeft={msLeft} />
        </div>

          <Card className="min-w-0 p-6 lg:col-start-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">How the price drops</h2>
                <p className="mt-1 text-sm text-muted">{strategyText[slot.strategy]}</p>
              </div>
              {nextDropMs !== null && nextDropMs > 0 && (slot.status === 'LIVE' || slot.status === 'HELD') && (
                <Badge tone="warn" className="text-sm">
                  Next drop in {countdown(nextDropMs)}
                </Badge>
              )}
            </div>
            <div className="mt-4">
              <PriceChart points={curve} floorPrice={slot.floorPrice} now={now} currentPrice={price} stepped={slot.strategy === 'STEP'} height={260} />
            </div>
          </Card>
      </div>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function PurchaseCard({ slot, price, msLeft }: { slot: Slot; price: number; msLeft: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = useNow();
  const [hold, setHold] = useState<Hold | null>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(true);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCtaVisible(e.isIntersecting), { rootMargin: '0px 0px -40px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Resume an existing hold after a page refresh.
  useEffect(() => {
    if (slot.myHold) setHold({ slotId: slot.id, price: slot.myHold.price, expiresAt: slot.myHold.expiresAt });
  }, [slot.id, slot.myHold?.expiresAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const grab = useMutation({
    mutationFn: () => api.hold(slot.id),
    onSuccess: (h) => setHold(h),
    onError: (e: ApiError) => toast.error(e.message),
  });

  const discount = Math.max(0, Math.round((1 - price / slot.basePrice) * 100));
  const isMine = !!slot.myHold;
  const heldByOther = slot.status === 'HELD' && !isMine;
  const holdLeft = slot.holdExpiresAt ? new Date(slot.holdExpiresAt).getTime() - now : 0;
  const onSale = (slot.status === 'LIVE' || slot.status === 'HELD') && msLeft > 0;
  const isOwner = user?.role === 'MERCHANT';

  let cta: React.ReactNode;
  let note: string | null = null;
  let mobileCta: React.ReactNode = null;
  if (slot.status === 'SOLD') {
    cta = <Button size="lg" variant="outline" className="w-full" disabled>Sold for {inr(slot.soldPrice ?? price)}</Button>;
  } else if (!onSale) {
    cta = <Button size="lg" variant="outline" className="w-full" disabled>No longer available</Button>;
  } else if (isMine) {
    cta = (
      <Button size="lg" className="w-full" onClick={() => setHold({ slotId: slot.id, price: slot.myHold!.price, expiresAt: slot.myHold!.expiresAt })}>
        <Lock className="size-4" /> Resume checkout · {countdown(new Date(slot.myHold!.expiresAt).getTime() - now)}
      </Button>
    );
  } else if (heldByOther) {
    cta = (
      <Button size="lg" variant="outline" className="w-full" disabled>
        <Lock className="size-4" /> Someone is checking out
      </Button>
    );
    note = `If they don't pay, it comes back in ${countdown(holdLeft)}. Stay on this page.`;
  } else if (isOwner) {
    cta = <Button size="lg" variant="outline" className="w-full" disabled>Use a customer account to book</Button>;
  } else if (!user) {
    cta = (
      <Button size="lg" className="w-full" onClick={() => navigate(`/login?next=/deals/${slot.id}`)}>
        Sign in to grab it
      </Button>
    );
  } else {
    cta = (
      <Button size="lg" className="w-full text-base" loading={grab.isPending} onClick={() => grab.mutate()}>
        <Sparkles className="size-4" /> Grab it for {inr(price)}
      </Button>
    );
    mobileCta = (
      <Button size="lg" className="w-full" loading={grab.isPending} onClick={() => grab.mutate()}>
        <Sparkles className="size-4" /> Grab it
      </Button>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-brand/10 to-transparent p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">{slot.status === 'SOLD' ? 'Sold at' : 'Current price'}</span>
            {discount > 0 && slot.status !== 'SOLD' && <Badge tone="brand" className="text-sm">−{discount}%</Badge>}
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            {slot.status === 'SOLD' ? (
              <span className="font-display text-5xl font-bold">{inr(slot.soldPrice ?? price)}</span>
            ) : (
              <AnimatedPrice value={price} showDrop className="font-display text-5xl font-bold tracking-tight" />
            )}
            <span className="text-lg text-muted line-through tabular-nums">{inr(slot.basePrice)}</span>
          </div>
          {onSale && slot.status !== 'SOLD' && (
            <p className="mt-2 text-sm text-muted">
              Wait and it may drop to <span className="font-semibold text-success">{inr(slot.floorPrice)}</span>, but someone else might grab it first.
            </p>
          )}
        </div>
        <div className="space-y-4 border-t border-border p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Booking closes in</span>
            <span className={cn('font-mono text-base font-bold tabular-nums', msLeft < 30 * 60_000 && 'text-brand')}>{msLeft > 0 ? countdown(msLeft) : 'Closed'}</span>
          </div>
          <div ref={ctaRef}>{cta}</div>
          {note && <p className="-mt-2 text-center text-xs text-muted">{note}</p>}
          <ul className="space-y-1.5 text-xs text-muted">
            <li className="flex items-center gap-2">
              <Lock className="size-3.5 text-success" /> Your price is locked for 2 minutes once you grab it
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-accent" /> Each slot sells exactly once, guaranteed
            </li>
          </ul>
        </div>
      </Card>
      <CheckoutModal slot={slot} hold={hold} onClose={() => setHold(null)} />
      {/* Mobile: keep price + action reachable once the main button scrolls away. */}
      {createPortal(
        <AnimatePresence>
          {!ctaVisible && !hold && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
              className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] backdrop-blur-xl lg:hidden"
            >
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <div className="text-[11px] text-muted line-through tabular-nums">{inr(slot.basePrice)}</div>
                  {slot.status === 'SOLD' ? (
                    <div className="font-display text-xl font-bold">{inr(slot.soldPrice ?? price)}</div>
                  ) : (
                    <AnimatedPrice value={price} className="font-display text-xl font-bold" />
                  )}
                </div>
                <div className="min-w-0 flex-1 [&_button]:h-11 [&_button]:text-sm">{mobileCta ?? cta}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
