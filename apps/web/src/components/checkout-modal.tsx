import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, CreditCard, Lock, Smartphone, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api, ApiError } from '../lib/api';
import { cn, countdown, duration, inr, newIdempotencyKey, when } from '../lib/format';
import { useNow } from '../lib/live-store';
import type { Booking, Hold, PaymentMethod, Slot } from '../lib/types';
import { Button, Modal } from './ui';

const METHODS: Array<{ id: PaymentMethod; label: string; sub: string; icon: typeof Smartphone }> = [
  { id: 'UPI', label: 'UPI', sub: 'GPay, PhonePe, Paytm', icon: Smartphone },
  { id: 'CARD', label: 'Card', sub: 'Visa, Mastercard, RuPay', icon: CreditCard },
  { id: 'WALLET', label: 'Wallet', sub: 'Amazon Pay, Mobikwik', icon: Wallet },
];

interface Props {
  slot: Slot;
  hold: Hold | null;
  onClose: () => void;
}

export function CheckoutModal({ slot, hold, onClose }: Props) {
  const qc = useQueryClient();
  const now = useNow();
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [booking, setBooking] = useState<Booking | null>(null);
  // One idempotency key per hold: retries of the same payment can never charge twice.
  const idemKey = useMemo(() => newIdempotencyKey(), [hold?.expiresAt]);

  const msLeft = hold ? new Date(hold.expiresAt).getTime() - now : 0;
  const expired = !!hold && msLeft <= 0 && !booking;
  const total = 120_000;
  const progress = Math.max(0, Math.min(1, msLeft / total));

  const pay = useMutation({
    mutationFn: () => api.checkout(slot.id, method, idemKey),
    onSuccess: (b) => {
      setBooking(b);
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['slot', slot.id] });
    },
    onError: (e: ApiError) => {
      toast.error(e.message);
      if (e.code === 'HOLD_EXPIRED' || e.code === 'SLOT_UNAVAILABLE') onClose();
    },
  });

  const cancel = async () => {
    if (hold && !booking) await api.release(slot.id).catch(() => {});
    qc.invalidateQueries({ queryKey: ['slot', slot.id] });
    onClose();
  };

  useEffect(() => {
    if (expired) toast.error('Your 2-minute hold expired. The slot is back on sale.');
  }, [expired]);

  const saved = hold ? slot.basePrice - hold.price : 0;

  return (
    <Modal open={!!hold} onClose={booking ? onClose : cancel} dismissable={!pay.isPending}>
      {booking ? (
        <div className="p-6 sm:p-8">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', bounce: 0.45, duration: 0.7 }} className="grid size-12 place-items-center rounded-full bg-success/12 text-success">
            <Check className="size-6" strokeWidth={2.5} />
          </motion.div>
          <h2 className="mt-6 font-display text-4xl font-medium leading-none tracking-[-0.045em]">
            It&rsquo;s <span className="font-serif italic">yours</span>.
          </h2>
          <p className="mt-3 text-[15px] text-muted">
            {booking.title} at {booking.businessName}
          </p>

          <motion.div
            initial={{ opacity: 0, y: 24, rotate: -1.5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ type: 'spring', bounce: 0.3, duration: 0.8, delay: 0.12 }}
            className="relative mt-7 rounded-2xl bg-surface-2"
          >
            <div className="px-5 pb-5 pt-4">
              <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                <span>Booking code</span>
                <span className="flex items-center gap-1.5 text-success">
                  <span className="size-1.5 rounded-full bg-current" /> Confirmed
                </span>
              </div>
              <div className="mt-3 break-all font-mono text-3xl font-medium tracking-[0.08em] sm:text-4xl">{booking.code}</div>
            </div>
            {/* Perforation: notches cut out with the modal's own fill + a dashed tear line. */}
            <div aria-hidden className="relative h-0">
              <span className="absolute -left-2.5 -top-2.5 size-5 rounded-full bg-surface" />
              <span className="absolute -right-2.5 -top-2.5 size-5 rounded-full bg-surface" />
              <span className="absolute inset-x-5 top-0 border-t border-dashed border-surface-3" />
            </div>
            <div className="grid grid-cols-2 gap-4 px-5 pb-4 pt-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">When</div>
                <div className="mt-1 text-sm font-medium">{when(booking.startsAt)}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Paid</div>
                <div className="mt-1 font-display text-lg font-medium tabular-nums">{inr(booking.pricePaid)}</div>
              </div>
            </div>
          </motion.div>

          {booking.originalPrice > booking.pricePaid && (
            <p className="mt-4 text-sm text-muted">
              You saved <span className="rounded-full bg-volt px-2 py-0.5 font-mono text-xs font-medium text-black">{inr(booking.originalPrice - booking.pricePaid)}</span> on the listed price.
            </p>
          )}
          <div className="mt-7 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="lg" onClick={onClose}>
              Keep browsing
            </Button>
            <Link to="/bookings" tabIndex={-1}>
              <Button size="lg" arrow className="w-full">
                My bookings
              </Button>
            </Link>
          </div>
        </div>
      ) : hold ? (
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-4 pr-10">
            <TimerRing progress={progress} label={countdown(msLeft)} urgent={msLeft < 30_000} />
            <div>
              <div className="flex items-center gap-1.5 font-display text-lg font-medium tracking-[-0.03em]">
                <Lock className="size-4 text-brand" /> Price locked for you
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted">Nobody else can book this slot while your timer runs. Pay before it hits zero.</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-surface-2 p-5">
            <div className="font-medium">{slot.title}</div>
            <div className="mt-0.5 text-sm text-muted">
              {slot.business.name} · {when(slot.startsAt)} · {duration(slot.durationMin)}
            </div>
            <div className="mt-5 flex items-end justify-between gap-4 border-t border-border pt-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">You pay</div>
                <div className="mt-1 font-display text-5xl font-medium leading-none tracking-[-0.045em] tabular-nums">{inr(hold.price)}</div>
              </div>
              <div className="pb-1 text-right">
                <div className="text-sm text-muted line-through tabular-nums">{inr(slot.basePrice)}</div>
                {saved > 0 && <div className="mt-1 rounded-full bg-volt px-2 py-0.5 font-mono text-[11px] font-medium text-black">−{inr(saved)}</div>}
              </div>
            </div>
          </div>

          <div className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Payment method</div>
          <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Payment method">
            {METHODS.map((m) => {
              const selected = method === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMethod(m.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl p-3.5 text-left transition-[background-color,box-shadow] duration-200 cursor-pointer',
                    selected ? 'bg-surface ring-2 ring-fg' : 'bg-surface-2 hover:bg-surface-3',
                  )}
                >
                  <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl transition-colors', selected ? 'bg-fg text-bg' : 'bg-surface text-muted')}>
                    <m.icon className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{m.label}</div>
                    <div className="truncate text-xs text-muted">{m.sub}</div>
                  </div>
                  <span className={cn('grid size-5 shrink-0 place-items-center rounded-full transition-colors', selected ? 'bg-fg' : 'bg-surface-3')}>
                    <motion.span initial={false} animate={{ scale: selected ? 1 : 0 }} transition={{ type: 'spring', bounce: 0.4, duration: 0.35 }} className="size-2 rounded-full bg-bg" />
                  </span>
                </button>
              );
            })}
          </div>

          <Button variant="brand" size="lg" className="mt-6 w-full" loading={pay.isPending} disabled={expired} onClick={() => pay.mutate()}>
            {pay.isPending ? 'Processing payment…' : expired ? 'Hold expired' : `Pay ${inr(hold.price)}`}
          </Button>
          <button onClick={cancel} disabled={pay.isPending} className="mt-3 w-full rounded-full py-2 text-center text-sm text-muted transition-colors hover:text-fg disabled:opacity-50 cursor-pointer">
            Cancel and release slot
          </button>
          <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-muted/80">Demo payments only · no real money moves</p>
        </div>
      ) : null}
    </Modal>
  );
}

function TimerRing({ progress, label, urgent }: { progress: number; label: string; urgent: boolean }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-[68px] shrink-0 place-items-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={urgent ? 'var(--danger)' : 'var(--brand)'}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <span className={cn('font-mono text-[13px] font-medium tabular-nums transition-colors', urgent && 'text-danger')}>{label}</span>
    </div>
  );
}
