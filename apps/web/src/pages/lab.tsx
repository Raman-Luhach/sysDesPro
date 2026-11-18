import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Database, Play, Server, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EASE, Eyebrow, Reveal } from '../components/kit';
import { Badge, Button } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { cn, inr } from '../lib/format';
import type { Outcome, StampedeMode, StampedeResult } from '../lib/types';

type ModeTone = 'success' | 'accent' | 'danger';

const MODES: Array<{ id: StampedeMode; title: string; tag: string; tone: ModeTone; body: string; icon: typeof Zap }> = [
  {
    id: 'safe',
    title: 'Redis gate + DB lock',
    tag: 'Production path',
    tone: 'success',
    icon: ShieldCheck,
    body: 'An atomic Redis Lua script turns the crowd away in about a millisecond. A conditional UPDATE in Postgres confirms the one winner.',
  },
  {
    id: 'db-only',
    title: 'DB optimistic lock only',
    tag: 'Redis bypassed',
    tone: 'accent',
    icon: Database,
    body: 'Every buyer hits Postgres. UPDATE … WHERE version = ? AND status = LIVE lets exactly one row change, so it is still correct, just slower.',
  },
  {
    id: 'naive',
    title: 'Naive read-then-write',
    tag: 'The bug we prevent',
    tone: 'danger',
    icon: AlertTriangle,
    body: 'Read status, see LIVE, then write HELD with no condition. Every racer reads before anyone writes, so everyone "wins".',
  },
];

const TONE_ICON: Record<ModeTone, string> = {
  success: 'bg-success/12 text-success',
  accent: 'bg-accent/12 text-accent',
  danger: 'bg-danger/12 text-danger',
};

const OUTCOME_META: Record<Outcome, { label: string; color: string }> = {
  WON: { label: 'Won the slot', color: 'bg-success' },
  REJECTED_GATE: { label: 'Rejected by Redis gate', color: 'bg-fg/80' },
  REJECTED_STATE: { label: 'Saw it already held', color: 'bg-warn' },
  REJECTED_DB: { label: 'Lost the DB compare-and-set', color: 'bg-muted/50' },
  ERROR: { label: 'Error', color: 'bg-danger' },
};

/* Thin ink slider: 2px track filled to the value, small round thumb. */
const RANGE_CLASS =
  'h-[2px] w-full cursor-pointer appearance-none rounded-full accent-[var(--fg)] focus:outline-none ' +
  '[&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fg [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-200 hover:[&::-webkit-slider-thumb]:scale-115 focus-visible:[&::-webkit-slider-thumb]:scale-115 ' +
  '[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-fg';

const MIN_BUYERS = 10;
const MAX_BUYERS = 1000;

export function LabPage() {
  const qc = useQueryClient();
  const [buyers, setBuyers] = useState(500);
  const [mode, setMode] = useState<StampedeMode>('safe');
  const [result, setResult] = useState<StampedeResult | null>(null);
  const system = useQuery({ queryKey: ['system'], queryFn: api.system, refetchInterval: 10_000 });

  const run = useMutation({
    mutationFn: () => api.stampede(buyers, mode),
    onSuccess: (r) => setResult(r),
    onError: (e: ApiError) => toast.error(e.message),
  });
  const spawn = useMutation({
    mutationFn: api.spawnDeals,
    onSuccess: (r) => {
      toast.success(`${r.created} fresh deals are live`);
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const pct = ((buyers - MIN_BUYERS) / (MAX_BUYERS - MIN_BUYERS)) * 100;

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-[1fr_300px] lg:items-end lg:gap-16">
        <Reveal y={16}>
          <Eyebrow>Concurrency Lab</Eyebrow>
          <h1 className="mt-4 max-w-4xl font-display text-4xl leading-[1.02] font-medium tracking-[-0.045em] sm:text-5xl lg:text-6xl">
            What happens when <span className="font-serif tabular-nums italic">{buyers.toLocaleString('en-IN')}</span> people tap “Book” at the same moment?
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">
            This fires real, simultaneous hold requests at a brand-new slot through the actual booking service, with real Redis and Postgres. Pick a strategy and watch who wins.
          </p>
        </Reveal>

        <Reveal y={16} delay={0.1}>
          <div className="rounded-2xl bg-surface-2 p-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                <Server className="size-3.5" /> System
              </span>
              <span className={cn('relative size-1.5 rounded-full', system.data ? 'bg-success text-success live-dot' : 'bg-muted/50')} aria-hidden />
            </div>
            <dl className="mt-4 space-y-2 font-mono text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">instance</dt>
                <dd className="truncate text-fg">{system.data?.instance ?? '…'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">job leader</dt>
                <dd className="text-fg">{system.data ? (system.data.isLeader ? 'yes' : 'no') : '…'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">hold ttl</dt>
                <dd className="text-fg">{system.data?.holdTtlSeconds ?? '…'}s</dd>
              </div>
            </dl>
            <Button variant="secondary" size="sm" className="mt-5 w-full bg-surface hover:bg-surface-3" loading={spawn.isPending} onClick={() => spawn.mutate()}>
              <Sparkles className="size-3.5" /> Spawn 8 fresh deals
            </Button>
          </div>
        </Reveal>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-[400px_1fr] lg:gap-8">
        <div className="h-fit space-y-8 rounded-3xl bg-surface p-6 sm:p-7">
          <div>
            <div className="text-sm text-muted">Simultaneous buyers</div>
            <div className="mt-2 font-display text-7xl leading-none font-medium tracking-[-0.05em] tabular-nums sm:text-8xl">{buyers.toLocaleString('en-IN')}</div>
            <div className="mt-6 flex h-5 items-center">
              <input
                type="range"
                aria-label="Simultaneous buyers"
                min={MIN_BUYERS}
                max={MAX_BUYERS}
                step={10}
                value={buyers}
                onChange={(e) => setBuyers(Number(e.target.value))}
                className={RANGE_CLASS}
                style={{ background: `linear-gradient(to right, var(--fg) ${pct}%, var(--surface-3) ${pct}%)` }}
              />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11px] text-muted">
              <span>{MIN_BUYERS}</span>
              <span>{MAX_BUYERS.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm text-muted">Locking strategy</div>
            <div className="space-y-2">
              {MODES.map((m) => {
                const selected = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setMode(m.id)}
                    className={cn(
                      'w-full rounded-2xl p-4 text-left transition-[background-color,box-shadow] duration-200 cursor-pointer',
                      selected ? 'bg-surface ring-2 ring-fg' : 'bg-surface-2 hover:bg-surface-3',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium">
                        <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', TONE_ICON[m.tone])}>
                          <m.icon className="size-3.5" />
                        </span>
                        {m.title}
                      </span>
                      <Badge tone={m.tone} className="shrink-0">
                        {m.tag}
                      </Badge>
                    </div>
                    <p className="mt-2.5 text-xs leading-relaxed text-muted">{m.body}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <Button variant="brand" size="lg" className="w-full" loading={run.isPending} onClick={() => run.mutate()}>
            {!run.isPending && <Play className="size-4 fill-current" />} Release the stampede
          </Button>
        </div>

        <div className="min-w-0">
          <AnimatePresence mode="wait">
            {result ? <Result key={result.slotId} r={result} /> : <Placeholder key="ph" running={run.isPending} buyers={buyers} />}
          </AnimatePresence>
        </div>
      </div>

      <Layers />
    </div>
  );
}

function Placeholder({ running, buyers }: { running: boolean; buyers: number }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <div className="grid min-h-[420px] place-items-center rounded-3xl bg-surface-2/50 p-8 text-center sm:p-10">
        <div>
          <div className={cn('font-display text-[7rem] leading-none font-light tracking-[-0.06em] text-muted/40 tabular-nums sm:text-[10rem]', running && 'animate-pulse')}>
            {buyers.toLocaleString('en-IN')}
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            <span aria-hidden className={cn('relative size-1.5 rounded-full bg-brand text-brand', running && 'live-dot')} />
            {running ? 'Buyers are racing…' : 'Ready when you are'}
          </div>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">Each square in the result is one buyer, coloured by what happened to their request.</p>
        </div>
      </div>
    </motion.div>
  );
}

function Result({ r }: { r: StampedeResult }) {
  const correct = r.winners === 1 && r.bookingsForSlot <= 1;
  const b = r.breakdown;
  const soleWinner = b.won === 1;
  const segments: Array<{ key: Outcome; n: number }> = [
    { key: 'WON', n: b.won },
    { key: 'REJECTED_GATE', n: b.rejectedGate },
    { key: 'REJECTED_STATE', n: b.rejectedState },
    { key: 'REJECTED_DB', n: b.rejectedDb },
    { key: 'ERROR', n: b.errors },
  ].filter((s) => s.n > 0) as Array<{ key: Outcome; n: number }>;
  const modeMeta = MODES.find((m) => m.id === r.mode);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }} className="space-y-6">
      <div className={cn('rounded-3xl p-6 sm:p-8', correct ? 'bg-success/10' : 'bg-danger/10')}>
        <div className={cn('flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]', correct ? 'text-success' : 'text-danger')}>
          {correct ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
          {correct ? 'Sold exactly once' : 'Double-sold'}
          {modeMeta && <span className="text-muted">· {modeMeta.title}</span>}
        </div>
        <h2 className={cn('mt-4 font-display text-3xl leading-[1.05] font-medium tracking-[-0.04em] sm:text-4xl', correct ? 'text-success' : 'text-danger')}>
          {correct ? `Exactly 1 winner · ${(r.buyers - 1).toLocaleString('en-IN')} turned away` : `${r.winners} buyers were told they won.`}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          {correct
            ? `Sold once${r.booking ? ` (booking ${r.booking.code} for ${inr(r.booking.pricePaid)})` : ''}. Final status: ${r.finalStatus}. Booking rows for this slot: ${r.bookingsForSlot}.`
            : `With no condition on the write, every racer overwrote the others. ${r.winners - 1} customers would show up for a slot that isn't theirs.`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-4">
        <Metric label="All done in" value={`${r.totalMs} ms`} />
        <Metric label="p50 latency" value={`${r.latency.p50} ms`} />
        <Metric label="p95 latency" value={`${r.latency.p95} ms`} />
        <Metric label="Served by" value={r.servedBy} />
      </div>

      <div className="rounded-3xl bg-surface p-6 sm:p-7">
        <div className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-surface-2">
          {segments.map((s) => (
            <motion.div
              key={s.key}
              className={cn('h-full first:rounded-l-full last:rounded-r-full', OUTCOME_META[s.key].color)}
              initial={{ width: 0 }}
              animate={{ width: `${(s.n / r.buyers) * 100}%` }}
              transition={{ duration: 0.8, ease: EASE }}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
          {segments.map((s) => (
            <span key={s.key} className="flex items-center gap-2 text-muted">
              <span className={cn('size-2 rounded-[2px]', OUTCOME_META[s.key].color)} />
              {OUTCOME_META[s.key].label}
              <span className="font-mono text-fg tabular-nums">{s.n}</span>
            </span>
          ))}
        </div>
        <div className="mt-6 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${r.buyers > 500 ? 9 : 12}px, 1fr))` }}>
          {/* Ring only a lone winner; when many "won" (naive mode) a ring on each cell reads as a wall of outlines. */}
          {r.attempts.map((a, i) => (
            <motion.div
              key={a.buyer}
              title={`Buyer #${a.buyer}: ${OUTCOME_META[a.outcome].label} (${a.ms} ms)`}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.0015, 0.9) }}
              className={cn('aspect-square rounded-[3px]', OUTCOME_META[a.outcome].color, a.outcome === 'WON' && soleWinner && 'relative z-10 ring-2 ring-success ring-offset-2 ring-offset-surface')}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-bg px-4 py-5 sm:px-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-2 truncate font-mono text-lg text-fg tabular-nums sm:text-xl">{value}</div>
    </div>
  );
}

function Layers() {
  const layers = [
    { n: '01', title: 'Redis atomic gate', icon: Zap, body: 'A Lua script does "if no holder, set holder" as one indivisible step. Rejects the crowd in about 1 ms and shields Postgres.' },
    { n: '02', title: 'Optimistic lock (compare-and-set)', icon: Database, body: 'UPDATE slot SET status=HELD WHERE id=? AND version=? AND status=LIVE. Postgres row locking means only one UPDATE can change the row.' },
    { n: '03', title: 'UNIQUE(slotId) on bookings', icon: ShieldCheck, body: 'Even if everything above failed, the database physically refuses a second booking row for the same slot.' },
  ];
  return (
    <section className="mt-24 sm:mt-32">
      <Reveal y={16}>
        <Eyebrow>Defence in depth</Eyebrow>
        <h2 className="mt-4 max-w-3xl font-display text-3xl leading-[1.05] font-medium tracking-[-0.04em] sm:text-4xl">
          Three layers of <span className="font-serif italic">sell exactly once</span>
        </h2>
        <p className="mt-3 max-w-xl text-[15px] text-muted">Correctness never depends on the fast layer alone.</p>
      </Reveal>
      <div className="mt-10 grid divide-y divide-border border-t border-border md:grid-cols-3 md:divide-x md:divide-y-0">
        {layers.map((l, i) => (
          <Reveal key={l.n} delay={i * 0.1} className={cn('py-8 md:px-8 md:pb-4', i === 0 && 'md:pl-0', i === layers.length - 1 && 'md:pr-0')}>
            <div className="flex items-start justify-between gap-4">
              <span className="font-display text-6xl leading-none font-light tracking-[-0.05em] text-muted sm:text-7xl">/{l.n}</span>
              <l.icon className="mt-1 size-5 text-muted" />
            </div>
            <h3 className="mt-8 font-display text-xl font-medium tracking-[-0.025em]">{l.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{l.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
