import { motion } from 'framer-motion';
import { FlaskConical, ShieldCheck, Store, TrendingDown, User, Zap } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
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

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-flash p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -right-32 -top-32 size-[28rem] rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-40 -left-20 size-[26rem] rounded-full bg-black/10 blur-2xl" />
        <Link to="/" className="relative flex items-center gap-2 font-display text-xl font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-white/20 backdrop-blur">
            <Zap className="size-5 fill-white" />
          </span>
          FlashSlot
        </Link>
        <div className="relative mt-auto">
          <h2 className="font-display text-5xl font-bold leading-tight">
            Every empty slot
            <br />
            finds its buyer.
          </h2>
          <ul className="mt-8 space-y-4 text-white/90">
            <Feature icon={<TrendingDown className="size-5" />}>Prices drop automatically until someone books</Feature>
            <Feature icon={<ShieldCheck className="size-5" />}>Each slot sells exactly once, even with 1,000 buyers at the same second</Feature>
            <Feature icon={<Zap className="size-5" />}>Live updates over WebSockets, no refreshing</Feature>
          </ul>
        </div>
      </div>
      <div className="flex flex-col px-5 py-8 sm:px-12">
        <Logo className="lg:hidden" />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </div>
    </div>
  );
}

function Feature({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/15">{icon}</span>
      <span className="pt-1">{children}</span>
    </li>
  );
}

const DEMO = [
  { label: 'Customer', email: 'customer@flashslot.dev', icon: User, hint: 'Browse & book deals' },
  { label: 'Merchant', email: 'merchant@flashslot.dev', icon: Store, hint: 'List slots, see revenue' },
  { label: 'Admin', email: 'admin@flashslot.dev', icon: FlaskConical, hint: 'Concurrency Lab' },
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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          New here?{' '}
          <Link to="/register" className="font-semibold text-brand hover:underline">
            Create an account
          </Link>
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" size="lg" className="w-full" loading={busy === 'form'}>
            Sign in
          </Button>
        </form>

        <div className="my-8 flex items-center gap-3 text-xs text-muted">
          <div className="h-px flex-1 bg-border" />
          ONE-CLICK DEMO ACCOUNTS
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="grid gap-2">
          {DEMO.map((d) => (
            <button
              key={d.email}
              disabled={!!busy}
              onClick={() => void doLogin(d.email, 'password123', d.email)}
              className={cn('flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-all hover:border-brand/40 hover:bg-surface-2 disabled:opacity-60 cursor-pointer')}
            >
              <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-brand">
                <d.icon className="size-4.5" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold">{d.label}</span>
                <span className="block text-xs text-muted">{d.hint}</span>
              </span>
              {busy === d.email && <span className="size-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />}
            </button>
          ))}
        </div>
      </motion.div>
    </AuthShell>
  );
}

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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-muted">
          Already have one?{' '}
          <Link to="/login" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          {(
            [
              { id: 'CUSTOMER', title: 'I want deals', sub: 'Book last-minute slots', icon: User },
              { id: 'MERCHANT', title: 'I run a business', sub: 'Fill my empty slots', icon: Store },
            ] as const
          ).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id)}
              className={cn(
                'rounded-xl border p-4 text-left transition-all cursor-pointer',
                role === r.id ? 'border-brand bg-brand/5 ring-4 ring-brand/10' : 'border-border hover:bg-surface-2',
              )}
            >
              <r.icon className={cn('size-5', role === r.id ? 'text-brand' : 'text-muted')} />
              <div className="mt-2 text-sm font-semibold">{r.title}</div>
              <div className="text-xs text-muted">{r.sub}</div>
            </button>
          ))}
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
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Create account
          </Button>
        </form>
      </motion.div>
    </AuthShell>
  );
}
