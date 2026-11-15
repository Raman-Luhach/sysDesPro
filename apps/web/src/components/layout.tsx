import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronDown, FlaskConical, LayoutDashboard, LogOut, Menu, Moon, ShieldCheck, Sun, Ticket, X, Zap } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { useRealtime } from '../context/realtime';
import { useTheme } from '../context/theme';
import { api } from '../lib/api';
import { cn, timeAgo } from '../lib/format';
import type { Role } from '../lib/types';
import { ErrorBoundary } from './error-boundary';
import { Button } from './ui';

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2 font-display text-lg font-bold tracking-tight', className)}>
      <span className="grid size-8 place-items-center rounded-xl bg-flash text-white shadow-lg shadow-brand/30">
        <Zap className="size-4.5 fill-white" />
      </span>
      FlashSlot
    </Link>
  );
}

function useNavLinks() {
  const { user } = useAuth();
  const links: Array<{ to: string; label: string; icon: ReactNode }> = [{ to: '/', label: 'Live deals', icon: <Zap className="size-4" /> }];
  if (user?.role === 'CUSTOMER' || user?.role === 'ADMIN') links.push({ to: '/bookings', label: 'My bookings', icon: <Ticket className="size-4" /> });
  if (user?.role === 'MERCHANT') links.push({ to: '/merchant', label: 'Dashboard', icon: <LayoutDashboard className="size-4" /> });
  if (user?.role === 'ADMIN') links.push({ to: '/lab', label: 'Concurrency Lab', icon: <FlaskConical className="size-4" /> });
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
  exit: { opacity: 0, y: -6, scale: 0.98 },
  transition: { duration: 0.15 },
};

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
      className="relative grid size-9 place-items-center overflow-hidden rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-fg cursor-pointer"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={theme} initial={{ y: -14, opacity: 0, rotate: -45 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: 14, opacity: 0, rotate: 45 }} transition={{ duration: 0.18 }}>
          {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </motion.span>
      </AnimatePresence>
    </button>
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
        className="relative grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-fg cursor-pointer"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-2 ring-bg">
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...dropdown} className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold">Notifications</span>
              <span className="text-xs text-muted">{data.length} total</span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {data.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <Bell className="mx-auto size-6 text-muted" />
                  <p className="mt-2 text-sm text-muted">Nothing yet. Grab a deal!</p>
                </div>
              )}
              {data.map((n) => (
                <Link key={n.id} to={n.link ?? '#'} onClick={() => setOpen(false)} className="flex gap-3 border-b border-border/60 px-4 py-3 transition-colors last:border-0 hover:bg-surface-2">
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-brand')} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{n.title}</span>
                      <span className="shrink-0 text-[11px] text-muted">{timeAgo(n.createdAt)}</span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{n.body}</span>
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

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  if (!user) return null;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-surface-2 cursor-pointer" aria-label="Account menu">
        <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-accent to-brand text-sm font-bold text-white">{user.name.charAt(0).toUpperCase()}</span>
        <span className="hidden max-w-32 truncate text-sm font-semibold lg:block">{user.name}</span>
        <ChevronDown className={cn('hidden size-4 text-muted transition-transform sm:block', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...dropdown} className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-2xl">
            <div className="px-3 py-2.5">
              <div className="truncate text-sm font-semibold">{user.name}</div>
              <div className="truncate text-xs text-muted">{user.email}</div>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-semibold capitalize text-accent">
                <ShieldCheck className="size-3" />
                {user.role.toLowerCase()}
              </span>
            </div>
            <div className="my-1 h-px bg-border" />
            <button
              onClick={() => {
                setOpen(false);
                logout();
                navigate('/');
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10 cursor-pointer"
            >
              <LogOut className="size-4" /> Sign out
            </button>
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
    <header className={cn('sticky top-0 z-40 border-b bg-bg/75 backdrop-blur-xl transition-[border-color,box-shadow]', scrolled ? 'border-border shadow-[0_1px_12px_-6px_rgb(0_0_0/0.12)]' : 'border-transparent')}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => cn('relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive ? 'text-fg' : 'text-muted hover:text-fg')}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-surface-2" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />}
                  <span className="relative flex items-center gap-1.5">
                    {l.icon}
                    {l.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <span
            title={connected ? 'Connected: prices update in real time' : 'Reconnecting…'}
            className={cn('mr-1 hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:flex', connected ? 'bg-success/10 text-success' : 'bg-warn/12 text-warn')}
          >
            <span className={cn('relative size-2 rounded-full bg-current', connected && 'live-dot')} />
            {connected ? 'Live' : 'Connecting'}
          </span>
          <ThemeToggle />
          {user && <NotificationBell />}
          {user ? (
            <div className="hidden sm:block">
              <UserMenu />
            </div>
          ) : (
            <div className="hidden items-center gap-2 pl-1 sm:flex">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Get started</Button>
              </Link>
            </div>
          )}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="grid size-9 place-items-center rounded-xl hover:bg-surface-2 md:hidden cursor-pointer" aria-label="Menu" aria-expanded={mobileOpen}>
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-border bg-bg md:hidden">
            <div className="space-y-1 px-4 py-3">
              {user && (
                <div className="mb-2 flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                  <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-accent to-brand text-sm font-bold text-white">{user.name.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{user.name}</div>
                    <div className="text-xs capitalize text-muted">{user.role.toLowerCase()}</div>
                  </div>
                </div>
              )}
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => cn('flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium', isActive ? 'bg-surface-2 text-fg' : 'text-muted')}>
                  {l.icon}
                  {l.label}
                </NavLink>
              ))}
              <button onClick={toggle} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted cursor-pointer">
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                {theme === 'dark' ? 'Light theme' : 'Dark theme'}
              </button>
              {user ? (
                <button
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-danger cursor-pointer"
                >
                  <LogOut className="size-4" /> Sign out
                </button>
              ) : (
                <div className="flex gap-2 pt-2">
                  <Link to="/login" className="flex-1">
                    <Button variant="outline" className="w-full">
                      Sign in
                    </Button>
                  </Link>
                  <Link to="/register" className="flex-1">
                    <Button className="w-full">Get started</Button>
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

function Footer() {
  return (
    <footer className="mt-10 border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <Logo />
          <p className="mt-2 max-w-sm text-sm text-muted">Empty slots become revenue. Prices drop until someone books, and every slot sells exactly once.</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <Link to="/" className="hover:text-fg">Live deals</Link>
          <Link to="/register" className="hover:text-fg">List your business</Link>
          <Link to="/login" className="hover:text-fg">Sign in</Link>
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
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:pb-12">
        <motion.div key={location.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, ease: "easeOut" }}>
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
        <span className="size-8 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
      </div>
    );
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
