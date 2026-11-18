import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Ban, CalendarClock, Eye, IndianRupee, Percent, Plus, Radio, Rocket, Target, TrendingUp } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AnimatedPrice } from '../components/animated-price';
import { CATEGORIES, CATEGORY_META, CategoryArt, STRATEGY_META } from '../components/category';
import { CountUp, Eyebrow, Reveal } from '../components/kit';
import { Badge, Button, EmptyState, Input, Label, Skeleton, Stat, Textarea } from '../components/ui';
import { useAuth } from '../context/auth';
import { api, ApiError } from '../lib/api';
import { cn, duration, inr, when } from '../lib/format';
import { useLivePrice, useLiveViewers } from '../lib/live-store';
import type { Business, Category, Slot, SlotStatus } from '../lib/types';

export function MerchantPage() {
  const business = useQuery({ queryKey: ['my-business'], queryFn: api.myBusiness });
  if (business.isLoading) return <Skeleton className="h-96 rounded-3xl" />;
  if (!business.data?.business) return <BusinessSetup />;
  return <Dashboard />;
}

/** Left-aligned first column, hairline-separated cells after it (2x2 on phones, 4 across on sm+). */
const CELL_PAD = ['pl-0 pr-4 sm:pr-6', 'pl-5 pr-4 sm:pl-6 sm:pr-6', 'pl-0 pr-4 sm:pl-6 sm:pr-6', 'pl-5 pr-0 sm:pl-6'];

const STAT_NUM = 'text-[28px] sm:text-4xl';

function SectionTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <div className="mb-5 flex items-baseline gap-3">
      <h2 className="font-display text-2xl font-medium tracking-[-0.03em]">{children}</h2>
      {count !== undefined && <span className="font-mono text-sm text-muted">{String(count).padStart(2, '0')}</span>}
    </div>
  );
}

function Dashboard() {
  const q = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard, refetchInterval: 20_000 });
  if (q.isLoading || !q.data) {
    return (
      <div>
        <div className="flex items-center gap-5">
          <Skeleton className="size-14 rounded-2xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-10 w-2/3 max-w-md" />
          </div>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={cn('space-y-3 bg-bg py-7', CELL_PAD[i])}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-28" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-16 h-80 rounded-3xl" />
      </div>
    );
  }
  const { business, stats, slots } = q.data;
  const active = slots.filter((s) => ['LIVE', 'HELD', 'DRAFT'].includes(s.status));
  const history = slots.filter((s) => !['LIVE', 'HELD', 'DRAFT'].includes(s.status));

  return (
    <div>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-5">
          <CategoryArt category={business.category} className="size-14 shrink-0 rounded-2xl" />
          <div className="min-w-0">
            <Eyebrow>Merchant dashboard</Eyebrow>
            <h1 className="mt-2 font-display text-4xl leading-[1.02] font-medium tracking-[-0.04em] break-words sm:text-5xl">{business.name}</h1>
            <p className="mt-2 text-[15px] text-muted">
              {business.address}, {business.city}
            </p>
          </div>
        </div>
        <Link to="/merchant/new" className="shrink-0">
          <Button size="lg" className="w-full sm:w-auto">
            <Plus className="size-4.5" /> New flash slot
          </Button>
        </Link>
      </header>

      <Reveal y={16} className="mt-12">
        <div className="grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-4">
          <Stat
            className={cn('bg-bg py-7', CELL_PAD[0])}
            label="Revenue recovered"
            value={<CountUp className={STAT_NUM} to={stats.revenue} format={(n) => inr(n)} />}
            sub="From slots that would have sat empty"
            icon={<IndianRupee className="size-3.5" />}
          />
          <Stat
            className={cn('bg-bg py-7', CELL_PAD[1])}
            label="Slots sold"
            value={<CountUp className={STAT_NUM} to={stats.soldCount} />}
            sub={`${stats.unsoldCount} went unsold`}
            icon={<TrendingUp className="size-3.5" />}
          />
          <Stat
            className={cn('bg-bg py-7', CELL_PAD[2])}
            label="Live right now"
            value={<CountUp className={STAT_NUM} to={stats.liveCount} />}
            sub="Prices dropping"
            icon={<Radio className="size-3.5 text-brand" />}
          />
          <Stat
            className={cn('bg-bg py-7', CELL_PAD[3])}
            label="Sell-through"
            value={<CountUp className={STAT_NUM} to={stats.sellThroughPct} format={(n) => `${Math.round(n)}%`} />}
            sub={`Avg discount ${stats.avgDiscountPct}%`}
            icon={<Target className="size-3.5" />}
          />
        </div>
      </Reveal>

      <section className="mt-16">
        <SectionTitle count={active.length}>Active slots</SectionTitle>
        <div className="rounded-3xl bg-surface px-5 sm:px-7">
          {active.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="size-6" />}
              title="No active slots"
              body="Got a cancellation or an empty hour? List it and let the price find a buyer."
              action={
                <Link to="/merchant/new">
                  <Button>
                    <Plus className="size-4" /> List a slot
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {active.map((s) => (
                <SlotRow key={s.id} slot={s} />
              ))}
            </div>
          )}
        </div>
      </section>

      {history.length > 0 && (
        <section className="mt-16">
          <SectionTitle count={history.length}>History</SectionTitle>
          <div className="rounded-3xl bg-surface px-5 py-2 sm:px-7">
            <div className="-mx-5 overflow-x-auto px-5 sm:-mx-7 sm:px-7">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                    <th className="py-4 pr-4 font-normal">Slot</th>
                    <th className="px-4 py-4 font-normal">Started</th>
                    <th className="px-4 py-4 font-normal">Status</th>
                    <th className="py-4 pl-4 text-right font-normal">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((s) => (
                    <tr key={s.id}>
                      <td className="max-w-[18rem] truncate py-4 pr-4 font-medium">{s.title}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-muted">{when(s.startsAt)}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="py-4 pl-4 text-right whitespace-nowrap tabular-nums">
                        {s.status === 'SOLD' ? (
                          <>
                            <span className="font-display text-base font-medium">{inr(s.soldPrice ?? 0)}</span> <span className="text-muted">/ {inr(s.basePrice)}</span>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

const STATUS_TONE: Record<SlotStatus, Parameters<typeof Badge>[0]['tone']> = {
  DRAFT: 'neutral',
  LIVE: 'brand',
  HELD: 'warn',
  SOLD: 'success',
  EXPIRED: 'neutral',
  CANCELLED: 'danger',
};
const STATUS_LABEL: Record<SlotStatus, string> = {
  DRAFT: 'Draft',
  LIVE: 'Live',
  HELD: 'In checkout',
  SOLD: 'Sold',
  EXPIRED: 'Unsold',
  CANCELLED: 'Cancelled',
};

function StatusBadge({ status }: { status: SlotStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} className="gap-1.5">
      {status === 'LIVE' && <span className="relative size-1.5 rounded-full bg-current live-dot" />}
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function SlotRow({ slot }: { slot: Slot }) {
  const qc = useQueryClient();
  const price = useLivePrice(slot.id, slot.currentPrice);
  const viewers = useLiveViewers(slot.id, slot.viewers);
  const action = useMutation({
    mutationFn: (kind: 'publish' | 'cancel') => (kind === 'publish' ? api.publishSlot(slot.id) : api.cancelSlot(slot.id)),
    onSuccess: (_, kind) => {
      toast.success(kind === 'publish' ? 'Slot is live! Prices start dropping now.' : 'Slot cancelled');
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const progress = (slot.basePrice - price) / (slot.basePrice - slot.floorPrice);
  const canPublish = slot.status === 'DRAFT';
  const canCancel = slot.status === 'DRAFT' || slot.status === 'LIVE';

  return (
    <motion.div layout className="flex flex-col gap-5 py-6 lg:flex-row lg:items-center lg:gap-10">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusBadge status={slot.status} />
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{STRATEGY_META[slot.strategy].label}</span>
        </div>
        <Link
          to={`/deals/${slot.id}`}
          className="mt-2.5 block truncate font-display text-xl font-medium tracking-[-0.025em] decoration-1 underline-offset-4 hover:underline"
        >
          {slot.title}
        </Link>
        <div className="mt-1 text-sm text-muted">
          {when(slot.startsAt)} · {duration(slot.durationMin)}
        </div>
      </div>

      <div className="flex items-center gap-6 lg:w-80">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            {slot.status === 'DRAFT' ? (
              <span className="font-display text-2xl font-medium tracking-[-0.03em] tabular-nums">{inr(slot.basePrice)}</span>
            ) : (
              <AnimatedPrice value={price} className="font-display text-2xl font-medium tracking-[-0.03em] tabular-nums" />
            )}
            <span className="font-mono text-[11px] text-muted">floor {inr(slot.floorPrice)}</span>
          </div>
          <div className="mt-2.5 h-[2px] overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-fg transition-[width] duration-700" style={{ width: `${Math.max(3, Math.min(1, progress) * 100)}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-sm text-muted" title="People viewing now">
          <Eye className="size-4" />
          <span className="tabular-nums">{viewers}</span>
        </div>
      </div>

      {(canPublish || canCancel) && (
        <div className="flex gap-2 lg:w-[11.5rem] lg:justify-end">
          {canPublish && (
            <Button size="sm" loading={action.isPending && action.variables === 'publish'} onClick={() => action.mutate('publish')}>
              <Rocket className="size-3.5" /> Publish
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="danger" loading={action.isPending && action.variables === 'cancel'} onClick={() => action.mutate('cancel')}>
              <Ban className="size-3.5" /> Cancel
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function BusinessSetup() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<Omit<Business, 'id'>>({ name: '', category: 'SALON', city: '', address: '', description: '' });
  const save = useMutation({
    mutationFn: () => api.saveBusiness(form),
    onSuccess: () => {
      toast.success('Business profile saved');
      qc.invalidateQueries({ queryKey: ['my-business'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  const firstName = user?.name.split(' ')[0];

  return (
    <div className="mx-auto max-w-2xl py-4 sm:py-8">
      <Reveal y={16} className="mb-10 text-center">
        <Eyebrow className="justify-center">Merchant onboarding</Eyebrow>
        <h1 className="mt-4 font-display text-4xl leading-[1] font-medium tracking-[-0.045em] sm:text-6xl">
          Set up your <span className="font-serif italic">business</span>
          {firstName && <span className="text-muted">, {firstName}</span>}
        </h1>
        <p className="mt-4 text-[15px] text-muted">Takes 30 seconds. Then list your first empty slot.</p>
      </Reveal>
      <Reveal y={20} delay={0.08}>
        <div className="rounded-3xl bg-surface p-6 sm:p-9">
          <form onSubmit={submit} className="space-y-6">
            <div>
              <Label htmlFor="bname">Business name</Label>
              <Input id="bname" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Glow Studio" />
            </div>
            <div>
              <Label>Category</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORIES.map((c: Category) => {
                  const m = CATEGORY_META[c];
                  const selected = form.category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setForm({ ...form, category: c })}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl p-3 text-left text-sm font-medium transition-[background-color,box-shadow] duration-200 cursor-pointer',
                        selected ? 'bg-surface ring-2 ring-fg' : 'bg-surface-2 hover:bg-surface-3',
                      )}
                    >
                      <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg transition-colors', selected ? 'bg-fg text-bg' : 'bg-surface text-muted')}>
                        <m.icon className="size-4" />
                      </span>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" required minLength={2} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Bengaluru" />
              </div>
              <div>
                <Label htmlFor="addr">Address</Label>
                <Input id="addr" required minLength={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="12th Main, Indiranagar" />
              </div>
            </div>
            <div>
              <Label htmlFor="desc" hint="Optional">
                Short description
              </Label>
              <Textarea id="desc" maxLength={300} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What makes your place special?" />
            </div>
            <Button type="submit" size="lg" arrow className="w-full" loading={save.isPending}>
              Save and continue
            </Button>
          </form>
        </div>
      </Reveal>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted">
        <Percent className="size-3.5" /> You only earn when a slot sells. No listing fees.
      </p>
    </div>
  );
}
