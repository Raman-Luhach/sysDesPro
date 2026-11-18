import { motion } from 'framer-motion';
import { ArrowRight, FlaskConical, Loader2, ShieldCheck, Store, TrendingDown, User, Zap } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EASE, Eyebrow, RevealWords } from '../components/kit';
import { Logo } from '../components/layout';
import { Button, Input, Label } from '../components/ui';
import { useAuth } from '../context/auth';
import { ApiError } from '../lib/api';
import { cn } from '../lib/format';
import type { User as AppUser } from '../lib/types';

function homeFor(user: AppUser): string {
  if (user.role === 'MERCHANT') return '/merchant';
  if (user.role === 'ADMIN') return '/lab';
  return '/';
}

const PHOTO = { backgroundImage: 'url(/img/auth.jpg)' };

/** Photo panel on the left (desktop), form column on the right. */
function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-2">
      <aside className="hidden p-3 lg:sticky lg:top-0 lg:block lg:h-screen">
        {/* Fallback fill keeps the panel intentional (and dark under white text) if the photo is missing. */}
        <div className="relative h-full overflow-hidden rounded-[28px] bg-fg text-white dark:bg-surface-2">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center"
            style={PHOTO}
            initial={{ scale: 1.06 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.8, ease: EASE }}
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

          <div className="relative flex h-full flex-col p-10 xl:p-12">
            <Logo className="text-white" />

            <LiveChip />

            <div className="mt-auto max-w-xl">
              <h2 className="font-display text-5xl font-medium leading-[0.98] tracking-[-0.045em] xl:text-6xl">
                <RevealWords text="Every empty slot" delay={0.2} />{' '}
                <RevealWords text="finds its buyer." delay={0.35} className="font-serif italic" />
              </h2>
              <motion.ul
                className="mt-10 space-y-3.5 text-[15px] text-white/80"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.7 }}
              >
                <Feature icon={<TrendingDown className="size-4" />}>Prices drop automatically until someone books</Feature>
                <Feature icon={<ShieldCheck className="size-4" />}>Each slot sells exactly once, even with 1,000 buyers at once</Feature>
                <Feature icon={<Zap className="size-4" />}>Live updates over WebSockets, no refreshing</Feature>
              </motion.ul>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col px-4 py-5 sm:px-10 lg:py-10">
        <div className="lg:hidden">
          <Logo />
          <div className="relative mt-5 h-40 overflow-hidden rounded-3xl bg-surface-2">
            <motion.div
              aria-hidden
              className="absolute inset-0 bg-cover bg-center"
              style={PHOTO}
              initial={{ scale: 1.06 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1.6, ease: EASE }}
            />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-6 pt-10 lg:py-10">{children}</div>
      </div>
    </div>
  );
}

/** Illustrative live deal floating over the photo. Static content, gentle float. */
function LiveChip() {
  return (
    <motion.div
      aria-hidden
      className="absolute right-10 top-[30%] xl:right-12"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.9 }}
    >
      <motion.div
        className="rounded-2xl bg-white/10 px-4 py-3.5 text-white backdrop-blur-md"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity }}
      >
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70">
          <span className="live-dot relative size-1.5 rounded-full bg-brand text-brand" />
          Live · dropping
        </div>
        <div className="mt-2 text-sm font-medium">Deep Tissue Massage</div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="font-display text-2xl font-medium tabular-nums tracking-[-0.03em]">₹1,240</span>
          <span className="rounded-full bg-volt px-2 py-0.5 text-xs font-medium text-black">↓ 38%</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Feature({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 text-white">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

/** Title + subline block shared by both forms. */
function FormHead({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children: ReactNode }) {
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-4 font-display text-5xl font-medium leading-[1] tracking-[-0.04em]">{title}</h1>
      <p className="mt-3 text-[15px] text-muted">{children}</p>
    </>
  );
}

const textLink = 'font-medium text-fg underline-offset-4 hover:underline';

const enter = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, ease: EASE } };

const DEMO = [
  { label: 'Customer', email: 'customer@flashslot.dev', icon: User, hint: 'Browse & book deals', tint: 'bg-accent/12 text-accent' },
  { label: 'Merchant', email: 'merchant@flashslot.dev', icon: Store, hint: 'List slots, see revenue', tint: 'bg-brand/12 text-brand' },
  { label: 'Admin', email: 'admin@flashslot.dev', icon: FlaskConical, hint: 'Concurrency Lab', tint: 'bg-success/12 text-success' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const doLogin = async (e: string, p: string, key: string) => {
    setBusy(key);
    try {
      const user = await login(e, p);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate(params.get('next') ?? homeFor(user), { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Sign in failed');
    } finally {
      setBusy(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void doLogin(email, password, 'form');
  };

  return (
    <AuthShell>
      <motion.div {...enter}>
        <FormHead
          eyebrow="Welcome back"
          title={
            <>
              Sign <span className="font-serif italic">in</span>
            </>
          }
        >
          New here?{' '}
          <Link to="/register" className={textLink}>
            Create an account
          </Link>
        </FormHead>

        <form onSubmit={submit} className="mt-10 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" size="lg" className="mt-2 w-full" loading={busy === 'form'}>
            Sign in
          </Button>
        </form>

        <div className="my-9 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">or try a demo account</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="grid gap-2">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              disabled={!!busy}
              onClick={() => void doLogin(d.email, 'password123', d.email)}
              className="group flex items-center gap-3.5 rounded-2xl bg-surface-2 p-3 pr-4 text-left transition-colors duration-200 hover:bg-surface-3 disabled:opacity-60 cursor-pointer disabled:cursor-default"
            >
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', d.tint)}>
                <d.icon className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{d.label}</span>
                  <span className="truncate text-[13px] text-muted">{d.hint}</span>
                </span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-muted">{d.email}</span>
              </span>
              {busy === d.email ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted" />
              ) : (
                <ArrowRight className="size-4 shrink-0 text-muted transition-[transform,color] duration-300 ease-out group-hover:translate-x-1 group-hover:text-fg" />
              )}
            </button>
          ))}
        </div>
      </motion.div>
    </AuthShell>
  );
}

const ROLES = [
  { id: 'CUSTOMER', title: 'I want deals', sub: 'Book last-minute slots', icon: User, tint: 'bg-accent/12 text-accent' },
  { id: 'MERCHANT', title: 'I run a business', sub: 'Fill my empty slots', icon: Store, tint: 'bg-brand/12 text-brand' },
] as const;

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<'CUSTOMER' | 'MERCHANT'>('CUSTOMER');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await register({ ...form, role });
      toast.success('Account created!');
      navigate(homeFor(user), { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Sign up failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <motion.div {...enter}>
        <FormHead
          eyebrow="Get started"
          title={
            <>
              Create your <span className="font-serif italic">account</span>
            </>
          }
        >
          Already have one?{' '}
          <Link to="/login" className={textLink}>
            Sign in
          </Link>
        </FormHead>

        <div className="mt-10 grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Account type">
          {ROLES.map((r) => {
            const selected = role === r.id;
            return (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setRole(r.id)}
                className={cn(
                  'rounded-2xl p-4 text-left transition-[background-color,box-shadow] duration-200 cursor-pointer',
                  selected ? 'bg-surface ring-2 ring-fg' : 'bg-surface-2 hover:bg-surface-3',
                )}
              >
                <span className={cn('grid size-9 place-items-center rounded-xl', r.tint)}>
                  <r.icon className="size-4.5" />
                </span>
                <div className="mt-4 text-sm font-medium">{r.title}</div>
                <div className="mt-0.5 text-[13px] text-muted">{r.sub}</div>
              </button>
            );
          })}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">{role === 'MERCHANT' ? 'Your name' : 'Name'}</Label>
            <Input id="name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Riya Sharma" />
          </div>
          <div>
            <Label htmlFor="remail">Email</Label>
            <Input id="remail" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
          </div>
          <div>
            <Label htmlFor="rpass" hint="At least 6 characters">
              Password
            </Label>
            <Input id="rpass" type="password" autoComplete="new-password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          </div>
          <Button type="submit" size="lg" className="mt-2 w-full" loading={busy}>
            Create account
          </Button>
        </form>
      </motion.div>
    </AuthShell>
  );
}
