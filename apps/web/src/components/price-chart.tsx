import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { clock, inr } from '../lib/format';
import type { CurvePoint } from '../lib/types';

interface Props {
  points: CurvePoint[];
  floorPrice: number;
  /** Highlights "now" on the curve. */
  now?: number;
  currentPrice?: number;
  height?: number;
  stepped?: boolean;
}

/** Round a step to 1/2/5 × 10^n so axis labels are ₹500, ₹1,000, ₹1,500 instead of ₹1,236. */
function niceStep(range: number, ticks: number): number {
  const raw = range / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

const rupeeTick = (v: number) => (v >= 10000 ? `₹${(v / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}k` : `₹${v.toLocaleString('en-IN')}`);

export function PriceChart({ points, floorPrice, now, currentPrice, height = 240, stepped = false }: Props) {
  const data = points.map((p) => ({ t: new Date(p.at).getTime(), price: p.price / 100 }));
  if (!data.length) return <div style={{ height }} className="grid place-items-center text-sm text-muted">Adjust the inputs to preview the curve</div>;

  const first = data[0].t;
  const last = data[data.length - 1].t;
  const showNow = now !== undefined && now >= first && now <= last;

  const prices = data.map((d) => d.price);
  const lo = Math.min(...prices, floorPrice / 100);
  const hi = Math.max(...prices);
  const step = niceStep(Math.max(hi - lo, 1), 4);
  const yMin = Math.max(0, Math.floor(lo / step) * step - (lo % step === 0 ? step : 0));
  const yMax = Math.ceil(hi / step) * step;
  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + 0.0001; v += step) yTicks.push(v);

  return (
    <div style={{ height }} className="w-full select-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[first, last]}
            tickFormatter={(t) => clock(new Date(t).toISOString())}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickMargin={10}
            axisLine={false}
            tickLine={false}
            minTickGap={48}
          />
          <YAxis
            ticks={yTicks}
            domain={[yMin, yMax]}
            tickFormatter={rupeeTick}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickMargin={6}
            axisLine={false}
            tickLine={false}
            width={58}
          />
          <Tooltip
            cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--fg)', boxShadow: 'var(--shadow)' }}
            labelStyle={{ color: 'var(--muted)', marginBottom: 2 }}
            labelFormatter={(t) => clock(new Date(Number(t)).toISOString())}
            formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Price']}
          />
          <ReferenceLine
            y={floorPrice / 100}
            stroke="var(--success)"
            strokeDasharray="5 5"
            label={{ value: `Floor ${inr(floorPrice)}`, fill: 'var(--success)', fontSize: 11, fontWeight: 600, position: 'insideTopRight' }}
          />
          <Area type={stepped ? 'stepAfter' : 'monotone'} dataKey="price" stroke="var(--brand)" strokeWidth={2.5} fill="url(#priceFill)" isAnimationActive={false} activeDot={{ r: 5, fill: 'var(--brand)', stroke: 'var(--surface)', strokeWidth: 2 }} />
          {showNow && <ReferenceLine x={now} stroke="var(--fg)" strokeOpacity={0.35} strokeDasharray="2 4" label={{ value: 'Now', position: 'top', fill: 'var(--muted)', fontSize: 11 }} />}
          {showNow && currentPrice !== undefined && <ReferenceDot x={now} y={currentPrice / 100} r={6} fill="var(--brand)" stroke="var(--surface)" strokeWidth={3} />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
