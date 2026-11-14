import { motion } from 'framer-motion';
import { Clock, Eye, Flame, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { countdown, cn, duration, inr, when } from '../lib/format';
import { useLivePrice, useLiveViewers, useNow } from '../lib/live-store';
import type { Slot } from '../lib/types';
import { AnimatedPrice } from './animated-price';
import { CATEGORY_META, CategoryArt, STRATEGY_META } from './category';

export function DealCard({ slot, index = 0 }: { slot: Slot; index?: number }) {
  const price = useLivePrice(slot.id, slot.currentPrice);
  const viewers = useLiveViewers(slot.id, slot.viewers);
  const now = useNow();
  const msLeft = new Date(slot.startsAt).getTime() - now;
  const discount = Math.max(0, Math.round((1 - price / slot.basePrice) * 100));
  const dropProgress = slot.basePrice === slot.floorPrice ? 1 : (slot.basePrice - price) / (slot.basePrice - slot.floorPrice);
  const held = slot.status === 'HELD';
  const sold = slot.status === 'SOLD';
  const closed = sold || slot.status === 'EXPIRED' || slot.status === 'CANCELLED' || msLeft <= 0;
  const urgent = msLeft > 0 && msLeft < 30 * 60_000;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.35 }} layout>
      <Link
        to={`/deals/${slot.id}`}
        className={cn(
          'group block overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-all duration-200',
          'hover:-translate-y-1 hover:shadow-xl hover:border-brand/30 focus-visible:outline-2 focus-visible:outline-brand',
          closed && 'opacity-70',
        )}
      >
        <div className="relative">
          <CategoryArt category={slot.category} className="h-28" iconSize="size-28" />
          <div className="absolute left-12 top-4 rounded-full bg-black/25 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur">
            {CATEGORY_META[slot.category].label}
          </div>
          {discount > 0 && !sold && (
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-sm font-bold text-brand shadow-lg">
              <Flame className="size-3.5 fill-brand" />−{discount}%
            </div>
          )}
          <div className="absolute bottom-3 left-4 text-sm font-semibold text-white drop-shadow">
            {when(slot.startsAt)} · {duration(slot.durationMin)}
          </div>
          {!closed && !held && (urgent || viewers >= 3) && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur">
              <span className="relative size-1.5 rounded-full bg-white live-dot" />
              {urgent ? 'Ending soon' : 'Hot'}
            </div>
          )}
          {(held || closed) && (
            <div className="absolute inset-0 grid place-items-center bg-black/45 backdrop-blur-[2px]">
              <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-sm font-bold text-black">
                {sold ? '✓ Sold' : held ? (<><Lock className="size-3.5" /> Someone's checking out</>) : 'Closed'}
              </span>
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            <span className="truncate font-medium">
              {slot.business.name} · {slot.business.city}
            </span>
            {viewers > 0 && (
              <span className="flex shrink-0 items-center gap-1">
                <Eye className="size-3.5" />
                {viewers}
              </span>
            )}
          </div>
          <h3 className="mt-1 line-clamp-1 font-display text-lg font-semibold leading-snug group-hover:text-brand transition-colors">{slot.title}</h3>

          <div className="mt-3 flex items-end justify-between">
            <div className="flex items-baseline gap-2">
              {sold ? (
                <span className="font-display text-2xl font-bold">{inr(slot.soldPrice ?? price)}</span>
              ) : (
                <AnimatedPrice value={price} className="font-display text-2xl font-bold" />
              )}
              <span className="text-sm text-muted line-through tabular-nums">{inr(slot.basePrice)}</span>
            </div>
            <span className="text-[11px] font-medium text-muted">{STRATEGY_META[slot.strategy].label}</span>
          </div>

          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <motion.div className="h-full rounded-full bg-flash" animate={{ width: `${Math.max(3, dropProgress * 100)}%` }} transition={{ duration: 0.7 }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted">
              <span>Floor {inr(slot.floorPrice)}</span>
              <span className={cn('flex items-center gap-1 font-semibold tabular-nums', urgent ? 'text-brand' : 'text-fg')}>
                <Clock className="size-3" />
                {msLeft > 0 ? `Closes in ${countdown(msLeft)}` : 'Closed'}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function DealCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="h-28 animate-pulse bg-surface-2" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-surface-2" />
        <div className="h-7 w-1/3 animate-pulse rounded bg-surface-2" />
        <div className="h-1.5 w-full animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}
