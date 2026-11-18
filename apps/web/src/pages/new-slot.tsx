import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Rocket, Save, TrendingDown, Waves, Zap } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eyebrow, Reveal } from '../components/kit';
import { PriceChart } from '../components/price-chart';
import { Button, Input, Label, Select, Textarea } from '../components/ui';
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

/* Thin ink slider: a 2px track filled up to the value, a small round thumb. No gradients beyond the hard-stop fill. */
const RANGE_CLASS =
  'h-[2px] w-full cursor-pointer appearance-none rounded-full accent-[var(--fg)] focus:outline-none ' +
  '[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fg [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-200 hover:[&::-webkit-slider-thumb]:scale-125 focus-visible:[&::-webkit-slider-thumb]:scale-125 ' +
  '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-fg';

function Range({ value, min, max, step = 1, onChange, label }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label?: string }) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={RANGE_CLASS}
      style={{ background: `linear-gradient(to right, var(--fg) ${pct}%, var(--surface-3) ${pct}%)` }}
    />
  );
}

function FormSection({ n, title, children, className }: { n: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('py-10', className)}>
      <div className="flex items-baseline gap-4">
        <span className="font-display text-5xl leading-none font-light tracking-[-0.05em] text-muted sm:text-6xl">/{n}</span>
        <h2 className="font-display text-2xl font-medium tracking-[-0.03em]">{title}</h2>
      </div>
      <div className="mt-8 space-y-6">{children}</div>
    </section>
  );
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
      <Link to="/merchant" className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fg">
        <ArrowLeft className="size-4 transition-transform duration-300 group-hover:-translate-x-0.5" /> Dashboard
      </Link>
      <Reveal y={16} className="mt-8">
        <Eyebrow>New listing</Eyebrow>
        <h1 className="mt-3 font-display text-4xl leading-[1] font-medium tracking-[-0.04em] sm:text-5xl">
          List a flash <span className="font-serif italic">slot</span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">Set a starting price and a floor. FlashSlot drops the price automatically until someone books.</p>
      </Reveal>

      <form onSubmit={(e) => submit(e, true)} className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[1fr_440px] lg:gap-16">
        <div className="min-w-0 divide-y divide-border">
          <FormSection n="01" title="What's on offer" className="pt-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" required minLength={3} maxLength={80} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Deep Tissue Massage" />
            </div>
            <div>
              <Label htmlFor="sdesc" hint={<span className="font-mono">{form.description.length}/500</span>}>
                Description
              </Label>
              <Textarea id="sdesc" maxLength={500} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What's included, who it's with, anything to bring…" />
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="starts">Starts at</Label>
                <Input id="starts" type="datetime-local" required value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
                {timeError && <p className="mt-1.5 text-xs text-danger">{timeError}</p>}
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
          </FormSection>

          <FormSection n="02" title="Pricing">
            <div className="grid gap-6 sm:grid-cols-2">
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
            {priceError && <p className="-mt-3 text-xs text-danger">{priceError}</p>}

            <div>
              <Label>Price curve</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {strategies.data?.map((s) => {
                  const Icon = STRATEGY_ICONS[s.kind];
                  const selected = form.strategy === s.kind;
                  return (
                    <button
                      key={s.kind}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => set('strategy', s.kind)}
                      className={cn(
                        'rounded-2xl p-4 text-left transition-[background-color,box-shadow] duration-200 cursor-pointer',
                        selected ? 'bg-surface ring-2 ring-fg' : 'bg-surface-2 hover:bg-surface-3',
                      )}
                    >
                      <span className={cn('grid size-8 place-items-center rounded-lg transition-colors', selected ? 'bg-brand/12 text-brand' : 'bg-bg/70 text-muted')}>
                        <Icon className="size-4" />
                      </span>
                      <div className="mt-3 text-sm font-medium">{s.label}</div>
                      <div className="mt-1 text-xs leading-snug text-muted">{s.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            {descriptor?.params.map((p) => (
              <div key={p.key}>
                <Label hint={<span className="font-mono text-fg">{params[p.key]}</span>}>{p.label}</Label>
                <div className="flex h-5 items-center">
                  <Range label={p.label} min={p.min} max={p.max} value={params[p.key]} onChange={(v) => set('params', { ...form.params, [p.key]: v })} />
                </div>
                <div className="mt-1.5 flex justify-between font-mono text-[11px] text-muted">
                  <span>{p.min}</span>
                  <span>{p.max}</span>
                </div>
              </div>
            ))}
          </FormSection>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl bg-surface p-6 sm:p-7">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              <span aria-hidden className="relative size-2 rounded-full bg-brand text-brand live-dot" />
              Live preview
            </div>
            <h3 className="mt-4 truncate font-display text-2xl font-medium tracking-[-0.03em]">{form.title || 'Your slot'}</h3>
            <p className="mt-1 text-sm text-muted">{startsAtIso ? `${when(startsAtIso)} · ${duration(form.durationMin)}` : 'Pick a start time'}</p>
            <div className="mt-5 -mx-2">
              <PriceChart points={curve} floorPrice={form.floor * 100} stepped={form.strategy === 'STEP'} height={220} />
            </div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-border border-y border-border">
              <Mini label="Now" value={inr(form.base * 100)} />
              <Mini label="Halfway" value={midPrice !== null ? inr(midPrice) : '—'} />
              <Mini label="At start" value={inr(form.floor * 100)} accent />
            </div>
            <div className="mt-6 grid gap-2">
              <Button type="submit" variant="brand" size="lg" className="w-full" loading={create.isPending && create.variables === true}>
                <Rocket className="size-4" /> Publish now
              </Button>
              <Button type="button" variant="secondary" className="w-full" loading={create.isPending && create.variables === false} onClick={(e) => submit(e, false)}>
                <Save className="size-4" /> Save as draft
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0 px-3 py-4 first:pl-0 last:pr-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className={cn('mt-1.5 truncate font-display text-lg font-medium tracking-[-0.03em] tabular-nums sm:text-xl', accent && 'text-success')}>{value}</div>
    </div>
  );
}
