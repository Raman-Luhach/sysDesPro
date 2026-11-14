import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-flash text-white shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--brand)_60%,transparent)] hover:brightness-110 active:brightness-95',
  secondary: 'bg-fg text-bg hover:opacity-90',
  outline: 'border border-border bg-surface hover:bg-surface-2',
  ghost: 'hover:bg-surface-2 text-fg',
  danger: 'bg-danger/10 text-danger hover:bg-danger/15',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all duration-150 select-none cursor-pointer',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl border border-border bg-surface shadow-card', className)}>{children}</div>;
}

type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'accent';
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  brand: 'bg-brand/12 text-brand',
  success: 'bg-success/12 text-success',
  warn: 'bg-warn/15 text-warn',
  danger: 'bg-danger/12 text-danger',
  accent: 'bg-accent/12 text-accent',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Label({ children, hint, htmlFor }: { children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between text-sm font-medium">
      <span>{children}</span>
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

const fieldClass =
  'w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-fg placeholder:text-muted/70 transition-colors focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldClass, 'h-11', className)} {...rest} />;
});

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, 'min-h-24 py-2.5', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldClass, 'h-11 cursor-pointer appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%239b9bb2' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} />;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex rounded-xl border border-border bg-surface p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer',
            value === o.value ? 'text-fg' : 'text-muted hover:text-fg',
          )}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${options.map((x) => x.value).join()}`} className="absolute inset-0 rounded-lg bg-surface-2" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, children, className, dismissable = true }: { open: boolean; onClose: () => void; children: ReactNode; className?: string; dismissable?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismissable && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, dismissable]);

  // Portal to <body>: a modal must never be trapped inside a parent's stacking context
  // (sticky/transformed ancestors would otherwise let later content paint over it).
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => dismissable && onClose()} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
            className={cn('relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-surface shadow-2xl sm:rounded-3xl', className)}
          >
            {dismissable && (
              <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-fg cursor-pointer">
                <X className="size-5" />
              </button>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">{icon}</div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon, className }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </Card>
  );
}
