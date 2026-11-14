import { Dumbbell, Flower2, Gamepad2, Palette, Scissors, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import type { Category, StrategyKind } from '../lib/types';

export const CATEGORY_META: Record<Category, { label: string; icon: LucideIcon; gradient: string }> = {
  SALON: { label: 'Salon', icon: Scissors, gradient: 'from-pink-500 via-fuchsia-500 to-purple-600' },
  FITNESS: { label: 'Fitness', icon: Dumbbell, gradient: 'from-lime-400 via-emerald-500 to-teal-600' },
  DINING: { label: 'Dining', icon: UtensilsCrossed, gradient: 'from-amber-400 via-orange-500 to-red-500' },
  WELLNESS: { label: 'Wellness', icon: Flower2, gradient: 'from-teal-400 via-cyan-500 to-sky-600' },
  ENTERTAINMENT: { label: 'Fun', icon: Gamepad2, gradient: 'from-violet-500 via-indigo-500 to-blue-600' },
  CLASSES: { label: 'Classes', icon: Palette, gradient: 'from-rose-400 via-orange-400 to-amber-500' },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

export const STRATEGY_META: Record<StrategyKind, { label: string; short: string }> = {
  LINEAR: { label: 'Steady glide', short: 'Drops every second' },
  STEP: { label: 'Timed drops', short: 'Drops in steps' },
  EXPONENTIAL: { label: 'Last-minute plunge', short: 'Falls faster near start' },
};

/** Decorative gradient banner with a big category icon. */
export function CategoryArt({ category, className = '', iconSize = 'size-16' }: { category: Category; className?: string; iconSize?: string }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${meta.gradient} ${className}`}>
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_45%),radial-gradient(circle_at_90%_80%,black_0,transparent_50%)]" />
      <Icon className={`absolute -right-3 -bottom-4 ${iconSize} rotate-[-12deg] text-white/25`} strokeWidth={1.5} />
      <Icon className="absolute left-4 top-4 size-6 text-white/90" strokeWidth={2} />
    </div>
  );
}
