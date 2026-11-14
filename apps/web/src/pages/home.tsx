import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Hourglass, Lock, MapPin, Search, SearchX, ShieldCheck, Sparkles, Store, TrendingDown, X, Zap } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES, CATEGORY_META } from '../components/category';
import { DealCard, DealCardSkeleton } from '../components/deal-card';
import { Button, EmptyState, Segmented, Select } from '../components/ui';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';
import { cn, inr, timeAgo } from '../lib/format';
import { useActivity, useNow } from '../lib/live-store';
import type { Category } from '../lib/types';

type Sort = 'ending' | 'discount' | 'price';

export function HomePage() {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category | undefined>();
  const [city, setCity] = useState('');
  const [sort, setSort] = useState<Sort>('ending');
  const [query, setQuery] = useState('');

  const feed = useQuery({
    queryKey: ['feed', category ?? 'all', city, sort],
    queryFn: () => api.feed({ category, city: city || undefined, sort }),
    refetchInterval: 30_000,
  });
  const cities = useQuery({ queryKey: ['cities'], queryFn: api.cities, staleTime: 60_000 });
  const all = useQuery({ queryKey: ['feed', 'all', '', 'ending'], queryFn: () => api.feed({}), refetchInterval: 30_000 });

  const live = (all.data ?? []).filter((s) => s.status === 'LIVE' || s.status === 'HELD');
  const maxDiscount = live.reduce((m, s) => Math.max(m, s.discountPct), 0);
  const filtersActive = !!(category || city || query);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return feed.data ?? [];
    return (feed.data ?? []).filter((s) => `${s.title} ${s.business.name} ${s.business.city}`.toLowerCase().includes(q));
  }, [feed.data, query]);

  const clear = () => {
    setCategory(undefined);
    setCity('');
    setQuery('');
  };

  return (
    <div>
      {/* HERO */}
      <section className="relative mb-6 overflow-hidden rounded-[2rem] border border-border bg-surface px-6 py-10 shadow-card sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -right-24 -top-24 size-[26rem] rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-1/4 size-96 rounded-full bg-accent/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              <span className="relative size-2 rounded-full bg-current live-dot" />
              {all.isLoading ? 'Loading live deals…' : `${live.length} deals dropping right now`}
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="font-display text-4xl font-bold leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl">
              Empty slots. <span className="text-flash">Falling prices.</span>
              <br />
              Grab it first.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Last-minute openings at salons, gyms, restaurants and studios. The price drops every few seconds until someone books it, and each slot sells exactly once.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => document.getElementById('deals')?.scrollIntoView({ behavior: 'smooth' })}>
                <Zap className="size-4 fill-current" /> Browse live deals
              </Button>
              {!user && (
                <Link to="/register">
                  <Button size="lg" variant="outline">
                    <Store className="size-4" /> List your empty slots
                  </Button>
                </Link>
              )}
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }} className="grid grid-cols-3 gap-3 lg:grid-cols-1">
            <HeroStat icon={<Zap className="size-4" />} label="Live deals" value={String(live.length)} />
            <HeroStat icon={<TrendingDown className="size-4" />} label="Biggest drop" value={`${maxDiscount}%`} highlight />
            <HeroStat icon={<ShieldCheck className="size-4" />} label="Double bookings" value="0" sub="Guaranteed" />
          </motion.div>
        </div>
      </section>

      <ActivityStrip />

      {/* FILTERS */}
      <section id="deals" className="sticky top-16 z-30 -mx-4 mb-6 scroll-mt-20 border-b border-transparent bg-bg/85 px-4 pb-3 pt-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:px-0">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search haircut, massage, escape room…"
                aria-label="Search deals"
                className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-9 text-sm shadow-card placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg cursor-pointer">
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1 sm:flex-none">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted" />
                <Select value={city} onChange={(e) => setCity(e.target.value)} className="h-11 w-full pl-9 shadow-card sm:w-44" aria-label="City">
                  <option value="">All cities</option>
                  {cities.data?.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <Segmented<Sort>
                value={sort}
                onChange={setSort}
                className="hidden shadow-card lg:inline-flex"
                options={[
                  { value: 'ending', label: 'Starting soon' },
                  { value: 'discount', label: 'Biggest drop' },
                  { value: 'price', label: 'Lowest price' },
                ]}
              />
              <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-11 w-40 shadow-card lg:hidden" aria-label="Sort">
                <option value="ending">Starting soon</option>
                <option value="discount">Biggest drop</option>
                <option value="price">Lowest price</option>
              </Select>
            </div>
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            <Chip active={!category} onClick={() => setCategory(undefined)}>
              <Sparkles className="size-4" /> All
            </Chip>
            {CATEGORIES.map((c) => {
              const Icon = CATEGORY_META[c].icon;
              return (
                <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? undefined : c)}>
                  <Icon className="size-4" />
                  {CATEGORY_META[c].label}
                </Chip>
              );
            })}
          </div>
        </div>
      </section>

      {/* GRID */}
      {feed.isError ? (
        <EmptyState icon={<SearchX className="size-6" />} title="Couldn't load deals" body={(feed.error as Error).message} action={<Button onClick={() => feed.refetch()}>Try again</Button>} />
      ) : feed.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <DealCardSkeleton key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-6" />}
          title={filtersActive ? 'No deals match your filters' : 'No live deals right now'}
          body={filtersActive ? 'Try another category, city or search term.' : 'New slots appear the moment a business lists them. This page updates live.'}
          action={
            filtersActive && (
              <Button variant="outline" onClick={clear}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between text-sm text-muted">
            <span>
              Showing <span className="font-semibold text-fg">{visible.length}</span> {visible.length === 1 ? 'deal' : 'deals'}
            </span>
            {filtersActive && (
              <button onClick={clear} className="font-medium text-brand hover:underline cursor-pointer">
                Clear filters
              </button>
            )}
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((s, i) => (
              <DealCard key={s.id} slot={s} index={i} />
            ))}
          </div>
        </>
      )}

      <HowItWorks />
    </div>
  );
}

function ActivityStrip() {
  const items = useActivity();
  useNow(); // re-render so "12s ago" stays fresh
  const latest = items[0];
  const meta = {
    sold: { icon: <ShieldCheck className="size-4" />, cls: 'bg-success/12 text-success', verb: 'just sold for' },
    held: { icon: <Lock className="size-4" />, cls: 'bg-warn/15 text-warn', verb: 'is being checked out at' },
    new: { icon: <Sparkles className="size-4" />, cls: 'bg-accent/12 text-accent', verb: 'just went live at' },
  } as const;

  return (
    <div className="mb-6 flex min-h-12 items-center gap-3 overflow-hidden rounded-2xl border border-border bg-surface px-4 py-2.5 shadow-card">
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
        <span className="relative size-2 rounded-full bg-brand live-dot" /> Live activity
      </span>
      <div className="h-5 w-px shrink-0 bg-border" />
      <div className="relative min-w-0 flex-1">
        <AnimatePresence mode="popLayout" initial={false}>
          {latest ? (
            <motion.div key={latest.id} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -18, opacity: 0 }} transition={{ duration: 0.3 }} className="flex min-w-0 items-center gap-2 text-sm">
              <span className={cn('grid size-6 shrink-0 place-items-center rounded-full', meta[latest.kind].cls)}>{meta[latest.kind].icon}</span>
              <span className="truncate">
                <span className="font-semibold">{latest.title}</span> <span className="text-muted">({latest.business})</span> {meta[latest.kind].verb}{' '}
                <span className="font-semibold">{inr(latest.price)}</span>
              </span>
              <span className="ml-auto shrink-0 text-xs text-muted">{timeAgo(new Date(latest.at).toISOString())}</span>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 truncate text-sm text-muted">
              <Hourglass className="size-4 shrink-0" /> Watching the market. Bookings and new listings appear here the instant they happen.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Store, title: 'A business lists an empty slot', body: 'A cancellation or a quiet hour goes live with a starting price and a floor price.' },
    { icon: TrendingDown, title: 'The price drops live', body: 'Every few seconds it gets cheaper. Wait for a better deal, or grab it before someone else does.' },
    { icon: Lock, title: 'Grab it and the price is locked', body: 'You get 2 minutes to pay at that price. Nobody else can book it in the meantime.' },
  ];
  return (
    <section className="mt-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">How FlashSlot works</h2>
          <p className="mt-1 text-muted">Fair for buyers, profitable for businesses.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }} className="relative rounded-2xl border border-border bg-surface p-6 shadow-card">
            <div className="flex items-center justify-between">
              <span className="grid size-11 place-items-center rounded-xl bg-brand/10 text-brand">
                <s.icon className="size-5" />
              </span>
              <span className="font-display text-4xl font-bold text-border">0{i + 1}</span>
            </div>
            <h3 className="mt-4 font-semibold">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
            {i < steps.length - 1 && <ArrowRight className="absolute -right-3.5 top-1/2 z-10 hidden size-7 -translate-y-1/2 rounded-full border border-border bg-surface p-1.5 text-muted md:block" />}
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function HeroStat({ icon, label, value, highlight, sub }: { icon: ReactNode; label: string; value: string; highlight?: boolean; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-bg/70 p-3.5 backdrop-blur sm:p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted sm:text-xs">
        <span className="hidden sm:inline">{icon}</span>
        {label}
      </div>
      <div className={cn('mt-1 font-display text-2xl font-bold tabular-nums sm:text-3xl', highlight && 'text-flash')}>{value}</div>
      {sub && <div className="hidden text-[11px] font-medium text-success sm:block">{sub}</div>}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all cursor-pointer',
        active ? 'border-transparent bg-fg text-bg shadow-md' : 'border-border bg-surface text-muted hover:border-fg/20 hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}
