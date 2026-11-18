import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowRight, Hourglass, Lock, MapPin, Search, SearchX, ShieldCheck, Sparkles, X, Zap } from 'lucide-react';
import { Fragment, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AnimatedPrice } from '../components/animated-price';
import { CATEGORIES, CATEGORY_META } from '../components/category';
import { DealCard, DealCardSkeleton } from '../components/deal-card';
import { CountUp, EASE, Eyebrow, Marquee, Reveal, RevealWords } from '../components/kit';
import { Button, EmptyState, Segmented, Select } from '../components/ui';
import { useAuth } from '../context/auth';
import { api } from '../lib/api';
import { cn, inr, timeAgo } from '../lib/format';
import { useActivity, useLivePrice, useNow } from '../lib/live-store';
import type { Category, Slot, User } from '../lib/types';

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
  const firstLive = live.find((s) => s.status === 'LIVE');
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
      <Hero liveCount={live.length} loading={all.isLoading} firstLive={firstLive} user={user} />

      {/* STATS */}
      <section className="mt-16 grid grid-cols-3 divide-x divide-border sm:mt-24">
        <Stat label="Live deals" value={<CountUp to={live.length} />} />
        <Stat label="Biggest drop" value={<CountUp to={maxDiscount} format={(n) => `${Math.round(n)}%`} />} accent />
        <Stat label="Double bookings" value="0" sub="Guaranteed" />
      </section>

      <CategoryMarquee />

      <ActivityStrip />

      {/* DEALS */}
      <section id="deals" className="mt-24 scroll-mt-20 sm:mt-32">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Live deals</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-medium tracking-[-0.04em] sm:text-6xl">
              Dropping <span className="font-serif italic">right now</span>
            </h2>
          </div>
          {!feed.isLoading && !feed.isError && visible.length > 0 && (
            <div className="flex items-center gap-4 text-sm text-muted">
              <span>
                Showing <span className="font-medium text-fg tabular-nums">{visible.length}</span> {visible.length === 1 ? 'deal' : 'deals'}
              </span>
              {filtersActive && (
                <button onClick={clear} className="font-medium text-fg underline-offset-4 hover:underline cursor-pointer">
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sticky filter bar */}
        <div className="sticky top-16 z-30 -mx-4 mt-8 mb-8 bg-bg/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search haircut, massage, escape room…"
                  aria-label="Search deals"
                  className="h-11 w-full rounded-full bg-surface-2 pl-11 pr-10 text-sm text-fg transition-colors placeholder:text-muted focus:bg-surface focus:outline-none focus:ring-2 focus:ring-fg/15"
                />
                {query && (
                  <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-surface-3 hover:text-fg cursor-pointer">
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <div className="relative min-w-0 flex-1 sm:flex-none">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted" />
                  <Select value={city} onChange={(e) => setCity(e.target.value)} className="h-11 w-full pl-9 sm:w-44" aria-label="City">
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
                  className="hidden lg:inline-flex"
                  options={[
                    { value: 'ending', label: 'Starting soon' },
                    { value: 'discount', label: 'Biggest drop' },
                    { value: 'price', label: 'Lowest price' },
                  ]}
                />
                <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-11 w-40 shrink-0 lg:hidden" aria-label="Sort">
                  <option value="ending">Starting soon</option>
                  <option value="discount">Biggest drop</option>
                  <option value="price">Lowest price</option>
                </Select>
              </div>
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              <Chip active={!category} onClick={() => setCategory(undefined)}>
                All
              </Chip>
              {CATEGORIES.map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? undefined : c)}>
                  {CATEGORY_META[c].label}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {feed.isError ? (
          <EmptyState icon={<SearchX className="size-6" />} title="Couldn't load deals" body={(feed.error as Error).message} action={<Button onClick={() => feed.refetch()}>Try again</Button>} />
        ) : feed.isLoading ? (
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
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
                <Button variant="secondary" onClick={clear}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((s, i) => (
              <DealCard key={s.id} slot={s} index={i} />
            ))}
          </div>
        )}
      </section>

      <HowItWorks />
      <Facts />
      <ForBusinesses user={user} />
    </div>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero({ liveCount, loading, firstLive, user }: { liveCount: number; loading: boolean; firstLive?: Slot; user: User | null }) {
  const media = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: media, offset: ['start end', 'end start'] });
  const scale = useTransform(scrollYProgress, [0, 1], [1.12, 1]);
  const y = useTransform(scrollYProgress, [0, 1], ['-6%', '6%']);

  return (
    <section className="pt-6 sm:pt-12">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        <span className="relative size-2 shrink-0 rounded-full bg-brand text-brand live-dot" />
        <span>
          Live marketplace <span className="mx-1">·</span> {loading ? 'loading deals…' : `${liveCount} ${liveCount === 1 ? 'deal' : 'deals'} dropping now`}
        </span>
      </motion.div>

      <h1 className="mt-6 font-display text-5xl font-medium leading-[0.95] tracking-[-0.045em] sm:text-7xl lg:text-8xl">
        <span className="block">
          <RevealWords text="Empty slots." />
        </span>
        <span className="block">
          <RevealWords text="Falling" delay={0.12} className="font-serif italic [&>span]:pr-[0.06em]" /> <RevealWords text="prices." delay={0.18} />
        </span>
        <span className="block">
          <RevealWords text="Grab it first." delay={0.28} />
        </span>
      </h1>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.45 }}
        className="mt-8 flex flex-col gap-6 sm:mt-10 lg:flex-row lg:items-end lg:justify-between"
      >
        <p className="max-w-md text-base leading-relaxed text-muted sm:text-lg">
          Last-minute openings at salons, gyms, restaurants and studios. The price drops every few seconds until someone books it. Each slot sells exactly once.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={() => document.getElementById('deals')?.scrollIntoView({ behavior: 'smooth' })} className="group">
            Browse live deals <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
          {!user && (
            <Link to="/register">
              <Button size="lg" variant="secondary">
                List your empty slots
              </Button>
            </Link>
          )}
        </div>
      </motion.div>

      <motion.div
        ref={media}
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: EASE, delay: 0.3 }}
        className="relative mt-10 aspect-[4/5] overflow-hidden rounded-[28px] bg-surface-2 sm:mt-14 sm:aspect-[16/8]"
      >
        <motion.div aria-hidden className="absolute -inset-y-[8%] inset-x-0 bg-cover bg-center" style={{ backgroundImage: 'url(/img/hero.jpg)', scale, y }} />
        {firstLive && <HeroChip slot={firstLive} />}
      </motion.div>
    </section>
  );
}

function HeroChip({ slot }: { slot: Slot }) {
  const price = useLivePrice(slot.id, slot.currentPrice);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.9 }} className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-auto">
      <Link to={`/deals/${slot.id}`} className="group flex items-center gap-4 rounded-2xl bg-bg/75 px-4 py-3 text-fg backdrop-blur-xl sm:max-w-sm">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            <span className="relative size-1.5 rounded-full bg-brand text-brand live-dot" /> Live now
          </div>
          <div className="mt-0.5 truncate text-sm font-medium group-hover:underline underline-offset-4">{slot.title}</div>
        </div>
        <div className="flex shrink-0 items-baseline gap-1">
          <AnimatedPrice value={price} className="font-display text-xl font-medium" />
          <ArrowDown className="size-4 self-center text-brand" />
        </div>
      </Link>
    </motion.div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: string; accent?: boolean }) {
  return (
    <Reveal className="px-3 first:pl-0 last:pr-0 sm:px-8">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted sm:text-[11px]">{label}</div>
      <div className={cn('mt-3 font-display text-4xl font-light leading-none tracking-[-0.05em] tabular-nums sm:text-7xl lg:text-8xl', accent && 'text-brand')}>{value}</div>
      {sub && <div className="mt-2 text-xs text-muted sm:text-sm">{sub}</div>}
    </Reveal>
  );
}

/* ───────────────────────── Marquee ───────────────────────── */

const MARQUEE_ACCENTS = ['last-minute', 'half price', 'tonight', 'dropping', 'right now', 'yours first'];

function CategoryMarquee() {
  return (
    <section aria-hidden className="-mx-4 mt-20 overflow-x-clip py-4 sm:-mx-6 sm:mt-28">
      <Marquee duration={70}>
        {CATEGORIES.map((c, i) => (
          <Fragment key={c}>
            <span className="whitespace-nowrap px-6 font-display text-6xl font-medium tracking-[-0.045em] sm:px-10 sm:text-8xl lg:text-9xl">{CATEGORY_META[c].label}</span>
            <Zap className="size-5 shrink-0 fill-brand text-brand sm:size-7" />
            <span className="whitespace-nowrap px-6 font-serif text-6xl italic text-muted sm:px-10 sm:text-8xl lg:text-9xl">{MARQUEE_ACCENTS[i % MARQUEE_ACCENTS.length]}</span>
            <span className="size-2 shrink-0 rounded-full bg-fg sm:size-3" />
          </Fragment>
        ))}
      </Marquee>
    </section>
  );
}

/* ───────────────────────── Activity ───────────────────────── */

function ActivityStrip() {
  const items = useActivity();
  useNow(); // re-render so "12s ago" stays fresh
  const latest = items[0];
  const meta = {
    sold: { icon: <ShieldCheck className="size-3.5" />, cls: 'bg-success/12 text-success', verb: 'just sold for' },
    held: { icon: <Lock className="size-3.5" />, cls: 'bg-warn/15 text-warn', verb: 'is being checked out at' },
    new: { icon: <Sparkles className="size-3.5" />, cls: 'bg-accent/12 text-accent', verb: 'just went live at' },
  } as const;

  return (
    <div className="mt-16 flex min-h-14 items-center gap-4 overflow-hidden border-y border-border py-3 sm:mt-20">
      <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted sm:text-[11px]">
        <span className="relative size-2 rounded-full bg-brand text-brand live-dot" /> <span className="hidden sm:inline">Live activity</span>
      </span>
      <div className="relative min-w-0 flex-1">
        <AnimatePresence mode="popLayout" initial={false}>
          {latest ? (
            <motion.div key={latest.id} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -18, opacity: 0 }} transition={{ duration: 0.3 }} className="flex min-w-0 items-center gap-2.5 text-sm">
              <span className={cn('grid size-6 shrink-0 place-items-center rounded-full', meta[latest.kind].cls)}>{meta[latest.kind].icon}</span>
              <span className="truncate">
                <span className="font-medium">{latest.title}</span> <span className="text-muted">({latest.business})</span> {meta[latest.kind].verb}{' '}
                <span className="font-medium tabular-nums">{inr(latest.price)}</span>
              </span>
              <span className="ml-auto shrink-0 font-mono text-xs text-muted">{timeAgo(new Date(latest.at).toISOString())}</span>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 truncate text-sm text-muted">
              <Hourglass className="size-4 shrink-0" /> <span className="truncate">Watching the market. Bookings and new listings appear here the instant they happen.</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ───────────────────────── How it works ───────────────────────── */

function HowItWorks() {
  const steps = [
    { title: 'A business lists an empty slot', body: 'A cancellation or a quiet hour goes live with a starting price and a floor price.' },
    { title: 'The price drops live', body: 'Every few seconds it gets cheaper. Wait for a better deal, or grab it before someone else does.' },
    { title: 'Grab it and the price is locked', body: 'You get 2 minutes to pay at that price. Nobody else can book it in the meantime.' },
  ];
  return (
    <section className="mt-32 grid gap-10 border-t border-border pt-16 lg:mt-40 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-4 font-display text-4xl font-medium tracking-[-0.04em] sm:text-6xl">
          How <span className="font-serif italic">FlashSlot</span> works
        </h2>
        <p className="mt-4 max-w-sm text-muted">Fair for buyers, profitable for businesses.</p>
      </div>
      <ol className="divide-y divide-border">
        {steps.map((s, i) => (
          <li key={s.title} className="py-10 first:pt-0 last:pb-0 sm:py-14">
            <Reveal>
              <div className="font-display text-7xl font-light leading-none tracking-[-0.05em] text-muted sm:text-9xl">/0{i + 1}</div>
              <h3 className="mt-6 font-display text-2xl font-medium sm:text-3xl">{s.title}</h3>
              <p className="mt-3 max-w-md leading-relaxed text-muted">{s.body}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ───────────────────────── Facts band ───────────────────────── */

const FACTS: Array<{ to: number; prefix?: string; unit?: string; body: string }> = [
  { to: 1, body: 'sale per slot, ever' },
  { to: 1, prefix: '~', unit: 'ms', body: 'Redis gate turns the crowd away' },
  { to: 2, unit: 'min', body: 'your price stays locked' },
  { to: 3, body: 'independent safety layers' },
  { to: 1000, body: 'simultaneous buyers tested' },
  { to: 0, body: 'double bookings' },
];

const TERMS = ['Redis Lua gate', 'Optimistic locking', 'Idempotency keys', 'Transactional outbox', 'Leader election', 'Circuit breaker', 'WebSockets', 'Rate limiting'];

function Facts() {
  return (
    <section className="mt-32 overflow-hidden rounded-[32px] bg-fg text-bg lg:mt-40">
      <div className="px-6 pt-14 sm:px-12 sm:pt-20">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-bg/60">
          <span aria-hidden className="size-2 shrink-0 bg-bg" />
          Under the hood
        </div>
        <h2 className="mt-5 max-w-3xl font-display text-4xl font-medium leading-[0.95] tracking-[-0.045em] sm:text-7xl">
          <RevealWords text="Built to sell" /> <RevealWords text="exactly once" delay={0.15} className="font-serif italic [&>span]:pr-[0.06em]" />
        </h2>
        <div className="mt-14 grid gap-x-10 sm:mt-20 sm:grid-cols-2 lg:grid-cols-3">
          {FACTS.map((f, i) => (
            <Reveal key={f.body} delay={(i % 3) * 0.1} className="border-t border-bg/15 py-8 sm:py-10">
              <div className="flex items-baseline font-display text-6xl font-light leading-none tracking-[-0.05em] tabular-nums sm:text-7xl lg:text-8xl">
                {f.prefix && <span className="text-bg/50">{f.prefix}</span>}
                <CountUp to={f.to} />
                {f.unit && <span className="ml-2 text-2xl font-normal tracking-[-0.02em] text-bg/60 sm:text-3xl">{f.unit}</span>}
              </div>
              <p className="mt-4 text-sm text-bg/60 sm:text-base">{f.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
      <div className="mt-6 border-t border-bg/15 py-6 sm:mt-10">
        <Marquee duration={50}>
          {TERMS.map((t) => (
            <span key={t} className="flex items-center whitespace-nowrap font-mono text-xs uppercase tracking-[0.14em] text-bg/60 sm:text-sm">
              <span className="px-6">{t}</span>
              <span className="size-1.5 rounded-full bg-brand" />
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}

/* ───────────────────────── For businesses ───────────────────────── */

function ForBusinesses({ user }: { user: User | null }) {
  const media = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: media, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-8%', '8%']);
  const href = user?.role === 'MERCHANT' ? '/merchant' : '/register';

  return (
    <section className="mt-32 grid items-center gap-10 lg:mt-40 lg:grid-cols-2 lg:gap-16">
      <div ref={media} className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-surface-2">
        <motion.div aria-hidden className="absolute -inset-y-[10%] inset-x-0 bg-cover bg-center" style={{ backgroundImage: 'url(/img/business.jpg)', y }} />
      </div>
      <div>
        <Eyebrow>For businesses</Eyebrow>
        <h2 className="mt-5 font-display text-4xl font-medium leading-[0.98] tracking-[-0.045em] sm:text-6xl">
          <RevealWords text="Got a cancellation?" /> <RevealWords text="List it" delay={0.12} className="font-serif italic [&>span]:pr-[0.06em]" />{' '}
          <RevealWords text="in 30 seconds." delay={0.2} />
        </h2>
        <Reveal delay={0.2}>
          <p className="mt-6 max-w-md leading-relaxed text-muted sm:text-lg">
            Set a starting price and a floor. FlashSlot drops the price live until someone books, so an empty chair turns into revenue instead of a loss.
          </p>
          <Link to={href} className="mt-8 inline-block">
            <Button size="lg" className="group">
              {user?.role === 'MERCHANT' ? 'Open your dashboard' : 'List your empty slots'}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors cursor-pointer',
        active ? 'bg-fg text-bg' : 'bg-surface-2 text-fg hover:bg-surface-3',
      )}
    >
      {children}
    </button>
  );
}
