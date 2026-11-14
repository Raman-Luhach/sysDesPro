import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle2, CreditCard, Lock, Smartphone, Wallet } from 'lucide-react';
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
        <div className="p-7 text-center">
          <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.5 }} className="mx-auto grid size-20 place-items-center rounded-full bg-success/15">
            <CheckCircle2 className="size-11 text-success" />
          </motion.div>
          <h2 className="mt-5 font-display text-2xl font-bold">You got it!</h2>
          <p className="mt-1 text-sm text-muted">
            {booking.title} at {booking.businessName}
          </p>
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface-2 p-4">
            <div className="text-xs uppercase tracking-widest text-muted">Booking code</div>
            <div className="mt-1 font-mono text-2xl font-bold tracking-wider">{booking.code}</div>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-muted">{when(booking.startsAt)}</span>
              <span className="font-semibold">{inr(booking.pricePaid)}</span>
            </div>
          </div>
          {booking.originalPrice > booking.pricePaid && (
            <p className="mt-4 text-sm font-semibold text-success">You saved {inr(booking.originalPrice - booking.pricePaid)} 🎉</p>
          )}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onClose}>
              Keep browsing
            </Button>
            <Link to="/bookings">
              <Button className="w-full">My bookings</Button>
            </Link>
          </div>
        </div>
      ) : hold ? (
        <div className="p-6 sm:p-7">
          <div className="flex items-center gap-4">
            <TimerRing progress={progress} label={countdown(msLeft)} urgent={msLeft < 30_000} />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-success">
                <Lock className="size-4" /> Price locked for you
              </div>
              <p className="mt-0.5 text-xs text-muted">Nobody else can book this slot while your timer runs. Pay before it hits zero.</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-surface-2 p-4">
            <div className="font-semibold">{slot.title}</div>
            <div className="mt-0.5 text-sm text-muted">
              {slot.business.name} · {when(slot.startsAt)} · {duration(slot.durationMin)}
            </div>
            <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
              <div>
                <div className="text-xs text-muted">You pay</div>
                <div className="font-display text-3xl font-bold tabular-nums">{inr(hold.price)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted line-through">{inr(slot.basePrice)}</div>
                {saved > 0 && <div className="text-sm font-semibold text-success">Save {inr(saved)}</div>}
              </div>
            </div>
          </div>

          <div className="mt-5 text-sm font-semibold">Payment method</div>
          <div className="mt-2 grid gap-2">
            {METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer',
                  method === m.id ? 'border-brand bg-brand/5 ring-4 ring-brand/10' : 'border-border hover:bg-surface-2',
                )}
              >
                <m.icon className={cn('size-5', method === m.id ? 'text-brand' : 'text-muted')} />
                <div className="flex-1">
                  <div className="text-sm font-semibold">{m.label}</div>
                  <div className="text-xs text-muted">{m.sub}</div>
                </div>
                <span className={cn('size-4 rounded-full border-2', method === m.id ? 'border-brand bg-brand shadow-[inset_0_0_0_3px_var(--surface)]' : 'border-border')} />
              </button>
            ))}
          </div>

          <Button size="lg" className="mt-6 w-full" loading={pay.isPending} disabled={expired} onClick={() => pay.mutate()}>
            {pay.isPending ? 'Processing payment…' : expired ? 'Hold expired' : `Pay ${inr(hold.price)}`}
          </Button>
          <button onClick={cancel} disabled={pay.isPending} className="mt-3 w-full text-center text-sm text-muted hover:text-fg disabled:opacity-50 cursor-pointer">
            Cancel and release slot
          </button>
          <p className="mt-4 text-center text-[11px] text-muted">Demo payments only. No real money moves.</p>
        </div>
      ) : null}
    </Modal>
  );
}

function TimerRing({ progress, label, urgent }: { progress: number; label: string; urgent: boolean }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-16 shrink-0 place-items-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={urgent ? 'var(--danger)' : 'var(--brand)'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className={cn('font-mono text-sm font-bold tabular-nums', urgent && 'text-danger')}>{label}</span>
    </div>
  );
}
