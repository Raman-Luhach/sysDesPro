import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Database, FlaskConical, Play, Server, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { cn, inr } from '../lib/format';
import type { Outcome, StampedeMode, StampedeResult } from '../lib/types';

const MODES: Array<{ id: StampedeMode; title: string; tag: string; tone: 'success' | 'accent' | 'danger'; body: string; icon: typeof Zap }> = [
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

const OUTCOME_META: Record<Outcome, { label: string; color: string }> = {
  WON: { label: 'Won the slot', color: 'bg-success' },
  REJECTED_GATE: { label: 'Rejected by Redis gate', color: 'bg-accent' },
  REJECTED_STATE: { label: 'Saw it already held', color: 'bg-warn' },
  REJECTED_DB: { label: 'Lost the DB compare-and-set', color: 'bg-sky-500' },
  ERROR: { label: 'Error', color: 'bg-danger' },
};

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

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <Badge tone="accent" className="mb-3">
            <FlaskConical className="size-3.5" /> Concurrency Lab
          </Badge>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">What happens when {buyers} people tap “Book” at the same moment?</h1>
          <p className="mt-2 text-muted">
            This fires real, simultaneous hold requests at a brand-new slot through the actual booking service, with real Redis and Postgres. Pick a strategy and watch who wins.
          </p>
        </div>
        <Card className="w-full p-4 text-sm sm:w-64">
          <div className="flex items-center gap-2 font-semibold">
            <Server className="size-4 text-muted" /> System
          </div>
          <dl className="mt-2 space-y-1 text-muted">
            <div className="flex justify-between">
              <dt>Instance</dt>
              <dd className="font-mono text-fg">{system.data?.instance ?? '…'}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Background-job leader</dt>
              <dd className="text-fg">{system.data ? (system.data.isLeader ? 'Yes' : 'No') : '…'}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Hold timer</dt>
              <dd className="text-fg">{system.data?.holdTtlSeconds ?? '…'}s</dd>
            </div>
          </dl>
          <Button variant="outline" size="sm" className="mt-3 w-full" loading={spawn.isPending} onClick={() => spawn.mutate()}>
            <Sparkles className="size-4" /> Spawn 8 fresh deals
          </Button>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit space-y-6 p-6">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">Simultaneous buyers</span>
              <span className="font-display text-2xl font-bold tabular-nums">{buyers}</span>
            </div>
            <input type="range" min={10} max={1000} step={10} value={buyers} onChange={(e) => setBuyers(Number(e.target.value))} className="mt-2 w-full accent-[var(--brand)]" />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-semibold">Locking strategy</span>
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  'w-full rounded-xl border p-3.5 text-left transition-all cursor-pointer',
                  mode === m.id ? 'border-brand bg-brand/5 ring-4 ring-brand/10' : 'border-border hover:bg-surface-2',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <m.icon className="size-4" />
                    {m.title}
                  </span>
                  <Badge tone={m.tone}>{m.tag}</Badge>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{m.body}</p>
              </button>
            ))}
          </div>
          <Button size="lg" className="w-full" loading={run.isPending} onClick={() => run.mutate()}>
            <Play className="size-4 fill-current" /> Release the stampede
          </Button>
        </Card>

        <div className="min-w-0">
          <AnimatePresence mode="wait">
            {result ? <Result key={result.slotId} r={result} /> : <Placeholder key="ph" running={run.isPending} />}
          </AnimatePresence>
        </div>
      </div>

      <Layers />
    </div>
  );
}

function Placeholder({ running }: { running: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Card className="grid min-h-[420px] place-items-center p-10 text-center">
        <div>
          <div className={cn('mx-auto grid size-16 place-items-center rounded-2xl bg-surface-2', running && 'animate-pulse')}>
            <Zap className="size-7 text-brand" />
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold">{running ? 'Buyers are racing…' : 'Ready when you are'}</h3>
          <p className="mt-1 max-w-sm text-sm text-muted">Each square in the result is one buyer, colored by what happened to their request.</p>
        </div>
      </Card>
    </motion.div>
  );
}

function Result({ r }: { r: StampedeResult }) {
  const correct = r.winners === 1 && r.bookingsForSlot <= 1;
  const b = r.breakdown;
  const segments: Array<{ key: Outcome; n: number }> = [
    { key: 'WON', n: b.won },
    { key: 'REJECTED_GATE', n: b.rejectedGate },
    { key: 'REJECTED_STATE', n: b.rejectedState },
    { key: 'REJECTED_DB', n: b.rejectedDb },
    { key: 'ERROR', n: b.errors },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
      <Card className={cn('overflow-hidden border-2', correct ? 'border-success/40' : 'border-danger/50')}>
        <div className={cn('flex flex-wrap items-center gap-4 p-6', correct ? 'bg-success/8' : 'bg-danger/8')}>
          <div className={cn('grid size-14 shrink-0 place-items-center rounded-2xl', correct ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger')}>
            {correct ? <CheckCircle2 className="size-8" /> : <AlertTriangle className="size-8" />}
          </div>
          <div className="flex-1">
            <h2 className={cn('font-display text-2xl font-bold', correct ? 'text-success' : 'text-danger')}>
              {correct ? `Exactly 1 winner · ${r.buyers - 1} turned away` : `${r.winners} buyers were told they won. Double-sold!`}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {correct
                ? `Sold once${r.booking ? ` (booking ${r.booking.code} for ${inr(r.booking.pricePaid)})` : ''}. Final status: ${r.finalStatus}. Booking rows for this slot: ${r.bookingsForSlot}.`
                : `With no condition on the write, every racer overwrote the others. ${r.winners - 1} customers would show up for a slot that isn't theirs.`}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-border sm:grid-cols-4">
          <Metric label="All requests done in" value={`${r.totalMs} ms`} />
          <Metric label="Median latency" value={`${r.latency.p50} ms`} />
          <Metric label="p95 latency" value={`${r.latency.p95} ms`} />
          <Metric label="Served by" value={r.servedBy} mono />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
          {segments
            .filter((s) => s.n > 0)
            .map((s) => (
              <motion.div key={s.key} className={OUTCOME_META[s.key].color} initial={{ width: 0 }} animate={{ width: `${(s.n / r.buyers) * 100}%` }} transition={{ duration: 0.6 }} />
            ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
          {segments
            .filter((s) => s.n > 0)
            .map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span className={cn('size-2.5 rounded-sm', OUTCOME_META[s.key].color)} />
                {OUTCOME_META[s.key].label}
                <span className="font-semibold tabular-nums">{s.n}</span>
              </span>
            ))}
        </div>
        <div className="mt-5 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${r.buyers > 500 ? 9 : 12}px, 1fr))` }}>
          {r.attempts.map((a, i) => (
            <motion.div
              key={a.buyer}
              title={`Buyer #${a.buyer}: ${OUTCOME_META[a.outcome].label} (${a.ms} ms)`}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.0015, 0.9) }}
              className={cn('aspect-square rounded-[3px]', OUTCOME_META[a.outcome].color, a.outcome === 'WON' && 'ring-2 ring-success ring-offset-2 ring-offset-surface')}
            />
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

function Metric({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-border p-4 [&:not(:last-child)]:border-r">
      <div className="text-xs text-muted">{label}</div>
      <div className={cn('mt-0.5 font-display text-lg font-bold tabular-nums', mono && 'font-mono text-base')}>{value}</div>
    </div>
  );
}

function Layers() {
  const layers = [
    { n: 1, title: 'Redis atomic gate', icon: Zap, body: 'A Lua script does "if no holder, set holder" as one indivisible step. Rejects the crowd in about 1 ms and shields Postgres.' },
    { n: 2, title: 'Optimistic lock (compare-and-set)', icon: Database, body: 'UPDATE slot SET status=HELD WHERE id=? AND version=? AND status=LIVE. Postgres row locking means only one UPDATE can change the row.' },
    { n: 3, title: 'UNIQUE(slotId) on bookings', icon: ShieldCheck, body: 'Even if everything above failed, the database physically refuses a second booking row for the same slot.' },
  ];
  return (
    <section className="mt-12">
      <h2 className="font-display text-xl font-semibold">Three layers of “sell exactly once”</h2>
      <p className="mt-1 text-sm text-muted">Defense in depth: correctness never depends on the fast layer alone.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {layers.map((l) => (
          <Card key={l.n} className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-flash font-display font-bold text-white">{l.n}</span>
              <l.icon className="size-5 text-muted" />
            </div>
            <h3 className="mt-3 font-semibold">{l.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{l.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
