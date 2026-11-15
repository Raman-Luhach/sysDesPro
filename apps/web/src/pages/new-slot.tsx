import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Rocket, Save, Sparkles, TrendingDown, Waves, Zap } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PriceChart } from '../components/price-chart';
import { Button, Card, Input, Label, Select, Textarea } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { cn, duration, inr, when } from '../lib/format';
import type { CurvePoint, StrategyKind } from '../lib/types';

const STRATEGY_ICONS: Record<StrategyKind, typeof Zap> = { LINEAR: TrendingDown, STEP: Waves, EXPONENTIAL: Zap };

function defaultStart(): string {
  const d = new Date(Date.now() + 2 * 60 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return toLocalInput(d);
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function NewSlotPage() {
  const navigate = useNavigate();
  const strategies = useQuery({ queryKey: ['strategies'], queryFn: api.strategies, staleTime: Infinity });
  const [form, setForm] = useState({
    title: '',
    description: '',
    startsAt: defaultStart(),
    durationMin: 60,
    base: 2000,
    floor: 800,
    strategy: 'EXPONENTIAL' as StrategyKind,
    params: {} as Record<string, number>,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const descriptor = strategies.data?.find((s) => s.kind === form.strategy);
  const params = useMemo(() => {
    const out: Record<string, number> = {};
    descriptor?.params.forEach((p) => (out[p.key] = form.params[p.key] ?? p.default));
    return out;
  }, [descriptor, form.params]);

  const startsAtIso = useMemo(() => {
    const d = new Date(form.startsAt);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }, [form.startsAt]);
  const priceError = form.floor >= form.base ? 'Floor must be lower than the starting price' : form.floor < form.base * 0.05 ? 'Floor must be at least 5% of the starting price' : null;
  const timeError = !startsAtIso || new Date(startsAtIso).getTime() < Date.now() + 10 * 60_000 ? 'Start at least 10 minutes from now' : null;

  const previewInput = useDebounced({ strategy: form.strategy, params, base: form.base, floor: form.floor, startsAtIso }, 250);
  const [curve, setCurve] = useState<CurvePoint[]>([]);
  useEffect(() => {
    const { startsAtIso: s, base, floor } = previewInput;
    if (!s || floor >= base || base < 1 || new Date(s).getTime() <= Date.now()) return;
    api
      .previewCurve({ strategy: previewInput.strategy, strategyParams: previewInput.params, basePrice: base * 100, floorPrice: floor * 100, liveAt: new Date().toISOString(), startsAt: s })
      .then((r) => setCurve(r.points))
      .catch(() => {});
  }, [previewInput]);

  const create = useMutation({
    mutationFn: (publishNow: boolean) =>
      api.createSlot({
        title: form.title,
        description: form.description,
        startsAt: startsAtIso!,
        durationMin: form.durationMin,
        basePrice: Math.round(form.base * 100),
        floorPrice: Math.round(form.floor * 100),
        strategy: form.strategy,
        strategyParams: params,
        publishNow,
      }),
    onSuccess: (_, publishNow) => {
      toast.success(publishNow ? 'Your slot is live! 🚀' : 'Saved as draft');
      navigate('/merchant');
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const submit = (e: FormEvent, publishNow = true) => {
    e.preventDefault();
    if (priceError || timeError) return toast.error(priceError ?? timeError!);
    create.mutate(publishNow);
  };

  const midPrice = curve.length ? curve[Math.floor(curve.length / 2)].price : null;

  return (
    <div>
      <Link to="/merchant" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Dashboard
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight">List a flash slot</h1>
      <p className="mt-1 text-muted">Set a starting price and a floor. FlashSlot drops the price automatically until someone books.</p>

      <form onSubmit={(e) => submit(e, true)} className="mt-8 grid gap-6 lg:grid-cols-[1fr_440px]">
        <div className="space-y-6">
          <Card className="space-y-5 p-6">
            <h2 className="font-display text-lg font-semibold">What's on offer</h2>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" required minLength={3} maxLength={80} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Deep Tissue Massage" />
            </div>
            <div>
              <Label htmlFor="sdesc" hint={`${form.description.length}/500`}>
                Description
              </Label>
              <Textarea id="sdesc" maxLength={500} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What's included, who it's with, anything to bring…" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="starts">Starts at</Label>
                <Input id="starts" type="datetime-local" required value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
                {timeError && <p className="mt-1 text-xs text-danger">{timeError}</p>}
              </div>
              <div>
                <Label htmlFor="dur">Duration</Label>
                <Select id="dur" value={form.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))}>
                  {[15, 30, 45, 60, 75, 90, 120, 150, 180, 240].map((m) => (
                    <option key={m} value={m}>
                      {duration(m)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </Card>

          <Card className="space-y-5 p-6">
            <h2 className="font-display text-lg font-semibold">Pricing</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="base" hint="Usual price">
                  Starting price (₹)
                </Label>
                <Input id="base" type="number" min={10} max={100000} required value={form.base} onChange={(e) => set('base', Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="floor" hint={form.base > 0 ? `${Math.round((1 - form.floor / form.base) * 100)}% off` : undefined}>
                  Floor price (₹)
                </Label>
                <Input id="floor" type="number" min={5} required value={form.floor} onChange={(e) => set('floor', Number(e.target.value))} />
              </div>
            </div>
            {priceError && <p className="-mt-2 text-xs text-danger">{priceError}</p>}

            <div>
              <Label>Price curve</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {strategies.data?.map((s) => {
                  const Icon = STRATEGY_ICONS[s.kind];
                  return (
                    <button
                      key={s.kind}
                      type="button"
                      onClick={() => set('strategy', s.kind)}
                      className={cn(
                        'rounded-xl border p-3 text-left transition-all cursor-pointer',
                        form.strategy === s.kind ? 'border-brand bg-brand/5 ring-4 ring-brand/10' : 'border-border hover:bg-surface-2',
                      )}
                    >
                      <Icon className={cn('size-5', form.strategy === s.kind ? 'text-brand' : 'text-muted')} />
                      <div className="mt-2 text-sm font-semibold">{s.label}</div>
                      <div className="mt-0.5 text-xs leading-snug text-muted">{s.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            {descriptor?.params.map((p) => (
              <div key={p.key}>
                <Label hint={String(params[p.key])}>{p.label}</Label>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={1}
                  value={params[p.key]}
                  onChange={(e) => set('params', { ...form.params, [p.key]: Number(e.target.value) })}
                  className="w-full accent-[var(--brand)]"
                />
              </div>
            ))}
          </Card>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted">
              <Sparkles className="size-4 text-brand" /> Live preview
            </div>
            <h3 className="mt-2 truncate font-display text-xl font-bold">{form.title || 'Your slot'}</h3>
            <p className="text-sm text-muted">{startsAtIso ? `${when(startsAtIso)} · ${duration(form.durationMin)}` : 'Pick a start time'}</p>
            <div className="mt-4 -mx-2">
              <PriceChart points={curve} floorPrice={form.floor * 100} stepped={form.strategy === 'STEP'} height={220} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Mini label="Now" value={inr(form.base * 100)} />
              <Mini label="Halfway" value={midPrice !== null ? inr(midPrice) : '—'} />
              <Mini label="At start" value={inr(form.floor * 100)} accent />
            </div>
            <div className="mt-6 grid gap-2">
              <Button type="submit" size="lg" loading={create.isPending && create.variables === true}>
                <Rocket className="size-4" /> Publish now
              </Button>
              <Button type="button" variant="outline" loading={create.isPending && create.variables === false} onClick={(e) => submit(e, false)}>
                <Save className="size-4" /> Save as draft
              </Button>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2 p-2.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={cn('text-sm font-bold tabular-nums', accent && 'text-success')}>{value}</div>
    </div>
  );
}
