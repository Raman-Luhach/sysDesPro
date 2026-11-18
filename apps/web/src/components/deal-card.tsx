import { motion } from 'framer-motion';
import { Eye, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { countdown, cn, duration, inr, when } from '../lib/format';
import { useLivePrice, useLiveViewers, useNow } from '../lib/live-store';
import type { Slot } from '../lib/types';
import { AnimatedPrice } from './animated-price';
import { CATEGORY_META, CategoryArt } from './category';

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
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.6, ease: [0.16, 1, 0.3, 1] }} layout>
      <Link to={`/deals/${slot.id}`} className={cn('group block rounded-2xl', closed && 'opacity-70')}>
        <CategoryArt category={slot.category} zoom className="aspect-[4/3] rounded-2xl">
          <span className="absolute left-3 top-3 rounded-full bg-bg/85 px-2.5 py-1 text-xs font-medium text-fg backdrop-blur">{CATEGORY_META[slot.category].label}</span>
          {discount > 0 && !sold && (
            <span className="absolute right-3 top-3 rounded-full bg-volt px-2.5 py-1 font-mono text-xs font-medium text-black">−{discount}%</span>
          )}
          {!closed && !held && (urgent || viewers >= 3) && (
            <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-white backdrop-blur">
              <span className="relative size-1.5 rounded-full bg-white live-dot" />
              {urgent ? 'Ending soon' : 'Hot'}
            </span>
          )}
          {(held || closed) && (
            <div className="absolute inset-0 grid place-items-center bg-black/45 backdrop-blur-[2px]">
              <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-black">
                {sold ? '✓ Sold' : held ? (<><Lock className="size-3.5" /> Someone's checking out</>) : 'Closed'}
              </span>
            </div>
          )}
        </CategoryArt>

        <div className="pt-4">
          <div className="flex items-center justify-between gap-3 text-xs text-muted">
            <span className="truncate">
              {slot.business.name} · {slot.business.city}
            </span>
            {viewers > 0 && (
              <span className="flex shrink-0 items-center gap-1 tabular-nums">
                <Eye className="size-3.5" />
                {viewers}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 line-clamp-1 font-display text-xl font-medium leading-snug decoration-1 underline-offset-4 group-hover:underline">{slot.title}</h3>

          <div className="mt-2 flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2">
              {sold ? (
                <span className="font-display text-2xl font-medium tabular-nums">{inr(slot.soldPrice ?? price)}</span>
              ) : (
                <AnimatedPrice value={price} className="font-display text-2xl font-medium" />
              )}
              <span className="text-sm text-muted line-through tabular-nums">{inr(slot.basePrice)}</span>
            </div>
            <span className="truncate text-xs text-muted">
              {when(slot.startsAt)} · {duration(slot.durationMin)}
            </span>
          </div>

          <div className="mt-4 h-[2px] overflow-hidden bg-surface-2">
            <div className={cn('h-full transition-[width] duration-700', urgent ? 'bg-brand' : 'bg-fg')} style={{ width: `${Math.max(3, Math.min(1, dropProgress) * 100)}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span>Floor {inr(slot.floorPrice)}</span>
            <span className={cn(urgent ? 'text-brand' : 'text-fg')}>
              {msLeft > 0 ? (
                <>
                  Closes in <span className="font-mono tabular-nums">{countdown(msLeft)}</span>
                </>
              ) : (
                'Closed'
              )}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function DealCardSkeleton() {
  return (
    <div>
      <div className="aspect-[4/3] animate-pulse rounded-2xl bg-surface-2" />
      <div className="space-y-2.5 pt-4">
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-surface-2" />
        <div className="h-5 w-3/4 animate-pulse rounded-full bg-surface-2" />
        <div className="h-6 w-1/3 animate-pulse rounded-full bg-surface-2" />
        <div className="!mt-4 h-[2px] w-full animate-pulse bg-surface-2" />
        <div className="flex justify-between">
          <div className="h-3 w-1/4 animate-pulse rounded-full bg-surface-2" />
          <div className="h-3 w-1/4 animate-pulse rounded-full bg-surface-2" />
        </div>
      </div>
    </div>
  );
}
