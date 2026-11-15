import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Ban, CalendarClock, Eye, IndianRupee, Percent, Plus, Radio, Rocket, Store, Target, TrendingUp } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AnimatedPrice } from '../components/animated-price';
import { CATEGORIES, CATEGORY_META, STRATEGY_META } from '../components/category';
import { Badge, Button, Card, EmptyState, Input, Label, Skeleton, Stat, Textarea } from '../components/ui';
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

function Dashboard() {
  const q = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard, refetchInterval: 20_000 });
  if (q.isLoading || !q.data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-1/2" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }
  const { business, stats, slots } = q.data;
  const active = slots.filter((s) => ['LIVE', 'HELD', 'DRAFT'].includes(s.status));
  const history = slots.filter((s) => !['LIVE', 'HELD', 'DRAFT'].includes(s.status));

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn('grid size-14 place-items-center rounded-2xl bg-gradient-to-br text-white', CATEGORY_META[business.category].gradient)}>
            {(() => {
              const Icon = CATEGORY_META[business.category].icon;
              return <Icon className="size-7" />;
            })()}
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">{business.name}</h1>
            <p className="text-sm text-muted">
              {business.address}, {business.city}
            </p>
          </div>
        </div>
        <Link to="/merchant/new">
          <Button size="lg">
            <Plus className="size-5" /> New flash slot
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue recovered" value={inr(stats.revenue)} sub="From slots that would have sat empty" icon={<IndianRupee className="size-4" />} />
        <Stat label="Slots sold" value={stats.soldCount} sub={`${stats.unsoldCount} went unsold`} icon={<TrendingUp className="size-4" />} />
        <Stat label="Live right now" value={stats.liveCount} sub="Prices dropping" icon={<Radio className="size-4 text-brand" />} />
        <Stat label="Sell-through" value={`${stats.sellThroughPct}%`} sub={`Avg discount ${stats.avgDiscountPct}%`} icon={<Target className="size-4" />} />
      </div>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-xl font-semibold">Active slots</h2>
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
          <div className="grid gap-3">
            {active.map((s) => (
              <SlotRow key={s.id} slot={s} />
            ))}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl font-semibold">History</h2>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-5 py-3 font-semibold">Slot</th>
                    <th className="px-5 py-3 font-semibold">Started</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s) => (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-3 font-medium">{s.title}</td>
                      <td className="px-5 py-3 text-muted">{when(s.startsAt)}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">
                        {s.status === 'SOLD' ? (
                          <>
                            {inr(s.soldPrice ?? 0)} <span className="font-normal text-muted">/ {inr(s.basePrice)}</span>
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
          </Card>
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
    <Badge tone={STATUS_TONE[status]}>
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

  return (
    <motion.div layout>
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={slot.status} />
            <span className="text-xs text-muted">{STRATEGY_META[slot.strategy].label}</span>
          </div>
          <Link to={`/deals/${slot.id}`} className="mt-1 block truncate font-display text-lg font-semibold hover:text-brand">
            {slot.title}
          </Link>
          <div className="text-sm text-muted">
            {when(slot.startsAt)} · {duration(slot.durationMin)}
          </div>
        </div>
        <div className="flex items-center gap-6 sm:w-80">
          <div className="flex-1">
            <div className="flex items-baseline justify-between">
              {slot.status === 'DRAFT' ? (
                <span className="font-display text-xl font-bold">{inr(slot.basePrice)}</span>
              ) : (
                <AnimatedPrice value={price} className="font-display text-xl font-bold" />
              )}
              <span className="text-xs text-muted">floor {inr(slot.floorPrice)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-flash transition-all duration-700" style={{ width: `${Math.max(3, progress * 100)}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted" title="People viewing now">
            <Eye className="size-4" />
            {viewers}
          </div>
        </div>
        <div className="flex gap-2">
          {slot.status === 'DRAFT' && (
            <Button size="sm" loading={action.isPending && action.variables === 'publish'} onClick={() => action.mutate('publish')}>
              <Rocket className="size-4" /> Publish
            </Button>
          )}
          {(slot.status === 'DRAFT' || slot.status === 'LIVE') && (
            <Button size="sm" variant="danger" loading={action.isPending && action.variables === 'cancel'} onClick={() => action.mutate('cancel')}>
              <Ban className="size-4" /> Cancel
            </Button>
          )}
        </div>
      </Card>
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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-flash text-white">
          <Store className="size-7" />
        </div>
        <h1 className="font-display text-3xl font-bold">Set up your business, {user?.name.split(' ')[0]}</h1>
        <p className="mt-2 text-muted">Takes 30 seconds. Then list your first empty slot.</p>
      </div>
      <Card className="p-6 sm:p-8">
        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label htmlFor="bname">Business name</Label>
            <Input id="bname" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Glow Studio" />
          </div>
          <div>
            <Label>Category</Label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c: Category) => {
                const m = CATEGORY_META[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, category: c })}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm font-medium transition-all cursor-pointer',
                      form.category === c ? 'border-brand bg-brand/5 ring-4 ring-brand/10' : 'border-border hover:bg-surface-2',
                    )}
                  >
                    <m.icon className={cn('size-5', form.category === c ? 'text-brand' : 'text-muted')} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
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
          <Button type="submit" size="lg" className="w-full" loading={save.isPending}>
            Save and continue
          </Button>
        </form>
      </Card>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
        <Percent className="size-3.5" /> You only earn when a slot sells. No listing fees.
      </p>
    </div>
  );
}
