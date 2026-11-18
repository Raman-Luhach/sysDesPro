import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Bell, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { useRealtime } from '../context/realtime';
import { useTheme } from '../context/theme';
import { api } from '../lib/api';
import { cn, timeAgo } from '../lib/format';
import type { Role } from '../lib/types';
import { ErrorBoundary } from './error-boundary';
import { EASE, Reveal } from './kit';
import { Button } from './ui';

/** The mark: vermilion rounded square + white bolt (same drawing as the favicon). */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-7 shrink-0', className)}>
      <rect width="32" height="32" rx="9" className="fill-brand" />
      <path d="M18.2 5 9 18h6.2l-1.6 9L23 13.6h-6.3z" fill="white" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="FlashSlot home" className={cn('flex shrink-0 items-center gap-2 font-display text-[19px] font-medium leading-none tracking-[-0.04em] text-current', className)}>
      <LogoMark />
      <span>
        Flash<span className="font-serif text-[1.12em] italic">Slot</span>
      </span>
    </Link>
  );
}

function useNavLinks() {
  const { user } = useAuth();
  const links: Array<{ to: string; label: string }> = [{ to: '/', label: 'Live deals' }];
  if (user?.role === 'CUSTOMER' || user?.role === 'ADMIN') links.push({ to: '/bookings', label: 'My bookings' });
  if (user?.role === 'MERCHANT') links.push({ to: '/merchant', label: 'Dashboard' });
  if (user?.role === 'ADMIN') links.push({ to: '/lab', label: 'Concurrency Lab' });
  return links;
}

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOutside();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOutside();
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onOutside]);
  return ref;
}

const dropdown = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
  transition: { duration: 0.22, ease: EASE },
};

const iconBtn = 'relative grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg cursor-pointer';

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
      className={cn(iconBtn, 'overflow-hidden')}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={theme} initial={{ y: -14, opacity: 0, rotate: -45 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: 14, opacity: 0, rotate: 45 }} transition={{ duration: 0.2 }}>
          {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function LiveStatus() {
  const { connected } = useRealtime();
  return (
    <span
      title={connected ? 'Connected: prices update in real time' : 'Reconnecting…'}
      className={cn('mr-2 hidden items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] sm:flex md:hidden lg:flex', connected ? 'text-muted' : 'text-warn')}
    >
      <span className={cn('relative size-1.5 rounded-full', connected ? 'live-dot bg-brand text-brand' : 'bg-warn')} />
      {connected ? 'Live' : 'Reconnecting'}
    </span>
  );
}

function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const { data = [] } = useQuery({ queryKey: ['notifications'], queryFn: api.notifications, refetchInterval: 60_000 });
  const unread = data.filter((n) => !n.readAt).length;
  const readAll = useMutation({ mutationFn: api.readAllNotifications, onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open && unread) readAll.mutate();
        }}
        className={iconBtn}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 font-mono text-[10px] font-medium text-white ring-2 ring-bg">
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...dropdown} style={{ originX: 1, originY: 0 }} className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-surface shadow-pop">
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              <span className="font-display text-base font-medium">Notifications</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{data.length} total</span>
            </div>
            <div className="h-px bg-border" />
            <div className="max-h-96 divide-y divide-border overflow-y-auto">
              {data.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto grid size-11 place-items-center rounded-full bg-surface-2 text-muted">
                    <Bell className="size-5" />
                  </div>
                  <p className="mt-3 text-sm text-muted">Nothing yet. Grab a deal.</p>
                </div>
              )}
              {data.map((n) => (
                <Link key={n.id} to={n.link ?? '#'} onClick={() => setOpen(false)} className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2">
                  <span className={cn('mt-[7px] size-1.5 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-brand')} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium">{n.title}</span>
                      <span className="shrink-0 font-mono text-[11px] text-muted">{timeAgo(n.createdAt)}</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{n.body}</span>
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return <span className={cn('grid size-8 shrink-0 place-items-center rounded-full bg-fg font-display text-sm font-medium text-bg', className)}>{name.charAt(0).toUpperCase()}</span>;
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  if (!user) return null;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-surface-2 cursor-pointer lg:pr-3" aria-label="Account menu" aria-expanded={open}>
        <Avatar name={user.name} />
        <span className="hidden max-w-32 truncate text-sm font-medium lg:block">{user.name.split(' ')[0]}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...dropdown} style={{ originX: 1, originY: 0 }} className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl bg-surface shadow-pop">
            <div className="flex items-center gap-3 px-4 py-4">
              <Avatar name={user.name} className="size-10 text-base" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{user.name}</div>
                <div className="truncate text-xs text-muted">{user.email}</div>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 pb-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Role</span>
              <span className="rounded-full bg-accent/12 px-2.5 py-0.5 text-xs font-medium capitalize text-accent">{user.role.toLowerCase()}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="p-1.5">
              <button
                onClick={() => {
                  setOpen(false);
                  logout();
                  navigate('/');
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
              >
                <LogOut className="size-4" /> Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useRealtime();
  const { theme, toggle } = useTheme();
  const links = useNavLinks();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={cn('sticky top-0 z-40 border-b bg-bg/80 backdrop-blur-xl transition-colors duration-300', scrolled || mobileOpen ? 'border-border' : 'border-transparent')}>
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr]">
        <Logo className="justify-self-start" />

        <nav className="hidden items-center gap-0.5 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => cn('relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors', isActive ? 'text-fg' : 'text-muted hover:text-fg')}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-surface-2" transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }} />}
                  <span className="relative">{l.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-1">
          <LiveStatus />
          <ThemeToggle />
          {user && <NotificationBell />}
          {user ? (
            <div className="hidden pl-1 sm:block">
              <UserMenu />
            </div>
          ) : (
            <div className="hidden items-center gap-1 pl-1 sm:flex">
              <Link to="/login" tabIndex={-1}>
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to="/register" tabIndex={-1}>
                <Button size="sm">Get started</Button>
              </Link>
            </div>
          )}
          <button onClick={() => setMobileOpen(!mobileOpen)} className={cn(iconBtn, 'text-fg md:hidden')} aria-label="Menu" aria-expanded={mobileOpen}>
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} className="overflow-hidden bg-bg md:hidden">
            <div className="px-4 pb-6 pt-2 sm:px-6">
              <div className="divide-y divide-border">
                {links.map((l, i) => (
                  <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => cn('flex items-baseline gap-4 py-4 font-display text-3xl font-medium tracking-[-0.04em] transition-colors', isActive ? 'text-fg' : 'text-muted')}>
                    <span className="w-6 font-mono text-[11px] tracking-normal text-muted">{String(i + 1).padStart(2, '0')}</span>
                    {l.label}
                  </NavLink>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
                <span className={cn('flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em]', connected ? 'text-muted' : 'text-warn')}>
                  <span className={cn('relative size-1.5 rounded-full', connected ? 'live-dot bg-brand text-brand' : 'bg-warn')} />
                  {connected ? 'Live prices' : 'Reconnecting'}
                </span>
                <button onClick={toggle} className="flex items-center gap-2 text-sm font-medium text-fg cursor-pointer">
                  {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                  {theme === 'dark' ? 'Light' : 'Dark'}
                </button>
              </div>

              {user ? (
                <div className="mt-3 flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                  <Avatar name={user.name} className="size-10 text-base" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{user.name}</div>
                    <div className="text-xs capitalize text-muted">{user.role.toLowerCase()}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      logout();
                      navigate('/');
                    }}
                  >
                    <LogOut className="size-4" /> Sign out
                  </Button>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link to="/login" tabIndex={-1}>
                    <Button variant="secondary" size="lg" className="w-full">
                      Sign in
                    </Button>
                  </Link>
                  <Link to="/register" tabIndex={-1}>
                    <Button size="lg" className="w-full">
                      Get started
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

const FOOTER_COLUMNS: Array<{ title: string; links: Array<{ to: string; label: string }> }> = [
  {
    title: 'Marketplace',
    links: [
      { to: '/', label: 'Live deals' },
      { to: '/bookings', label: 'My bookings' },
    ],
  },
  {
    title: 'Business',
    links: [
      { to: '/register', label: 'List your business' },
      { to: '/merchant', label: 'Merchant dashboard' },
    ],
  },
  {
    title: 'Account',
    links: [
      { to: '/login', label: 'Sign in' },
      { to: '/register', label: 'Create account' },
    ],
  },
];

function Footer() {
  return (
    <footer className="mt-16 bg-fg text-bg">
      <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 sm:pt-20">
        <Reveal className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-bg/55">
              <span aria-hidden className="size-2 shrink-0 bg-brand" />
              FlashSlot
            </div>
            <p className="mt-5 max-w-md font-display text-3xl font-medium leading-[1.05] tracking-[-0.04em] sm:text-4xl">
              Every empty slot finds its <span className="font-serif italic">buyer</span>.
            </p>
            <Link to="/" className="group mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-bg/70 transition-colors hover:text-bg">
              Browse live deals
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-bg/45">{col.title}</div>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link to={l.to} className="text-sm text-bg/75 transition-colors hover:text-bg">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.1} y={40} className="mt-16 sm:mt-24">
          <div aria-hidden className="select-none whitespace-nowrap font-display font-medium leading-[0.8] tracking-[-0.055em] text-bg/90" style={{ fontSize: 'min(calc((100vw - 3rem) * 0.285), 22.25rem)' }}>
            Flash<span className="ml-[0.04em] font-serif italic tracking-[-0.03em]">Slot</span>
          </div>
        </Reveal>

        <div className="mt-8 flex flex-col gap-2 border-t border-bg/15 py-6 font-mono text-[11px] uppercase tracking-[0.12em] text-bg/50 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 FlashSlot · System Design project</span>
          <span>Sold exactly once</span>
        </div>
      </div>
    </footer>
  );
}

export function AppLayout() {
  const location = useLocation();
  // New page = start at the top (otherwise opening a deal keeps the feed's scroll position).
  useEffect(() => {
    window.scrollTo(0, 0); // braces matter: scrollTo returns a Promise in new browsers
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:pb-12">
        <motion.div key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EASE }}>
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}

/** Route guard: requires sign-in (and optionally a role). */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <span className="size-7 animate-spin rounded-full border-2 border-surface-3 border-t-fg" />
      </div>
    );
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
