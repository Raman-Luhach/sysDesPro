import { Dumbbell, Flower2, Gamepad2, Palette, Scissors, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/format';
import type { Category, StrategyKind } from '../lib/types';

export const CATEGORY_META: Record<Category, { label: string; icon: LucideIcon; gradient: string; image: string }> = {
  SALON: { label: 'Salon', icon: Scissors, gradient: 'from-pink-500 via-fuchsia-500 to-purple-600', image: '/img/cat-salon.jpg' },
  FITNESS: { label: 'Fitness', icon: Dumbbell, gradient: 'from-lime-400 via-emerald-500 to-teal-600', image: '/img/cat-fitness.jpg' },
  DINING: { label: 'Dining', icon: UtensilsCrossed, gradient: 'from-amber-400 via-orange-500 to-red-500', image: '/img/cat-dining.jpg' },
  WELLNESS: { label: 'Wellness', icon: Flower2, gradient: 'from-teal-400 via-cyan-500 to-sky-600', image: '/img/cat-wellness.jpg' },
  ENTERTAINMENT: { label: 'Fun', icon: Gamepad2, gradient: 'from-violet-500 via-indigo-500 to-blue-600', image: '/img/cat-entertainment.jpg' },
  CLASSES: { label: 'Classes', icon: Palette, gradient: 'from-rose-400 via-orange-400 to-amber-500', image: '/img/cat-classes.jpg' },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

export const STRATEGY_META: Record<StrategyKind, { label: string; short: string }> = {
  LINEAR: { label: 'Steady glide', short: 'Drops every second' },
  STEP: { label: 'Timed drops', short: 'Drops in steps' },
  EXPONENTIAL: { label: 'Last-minute plunge', short: 'Falls faster near start' },
};

/**
 * Category photo block. The filled background shows while the photo loads (or if it is missing).
 * `zoom` scales the photo when a parent `.group` is hovered; `scrim` adds a light bottom shade for overlaid text.
 * `iconSize` is kept for compatibility and ignored.
 */
export function CategoryArt({
  category,
  className,
  children,
  zoom = false,
  scrim = false,
}: {
  category: Category;
  className?: string;
  iconSize?: string;
  children?: ReactNode;
  zoom?: boolean;
  scrim?: boolean;
}) {
  const meta = CATEGORY_META[category];
  return (
    <div className={cn('relative isolate overflow-hidden bg-surface-2', className)}>
      <div
        aria-hidden
        className={cn('absolute inset-0 -z-10 bg-cover bg-center', zoom && 'transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]')}
        style={{ backgroundImage: `url(${meta.image})` }}
      />
      {scrim && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-black/35 to-transparent" />}
      {children}
    </div>
  );
}
