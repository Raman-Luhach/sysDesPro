import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { ArrowRight, Loader2, X } from 'lucide-react';
import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/format';

type Variant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

/* No borders, no shadows: buttons are separated from the page by fill alone. */
const variants: Record<Variant, string> = {
  primary: 'bg-fg text-bg hover:bg-fg/85',
  brand: 'bg-brand text-white hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface-2 text-fg hover:bg-surface-3',
  outline: 'bg-surface-2 text-fg hover:bg-surface-3',
  ghost: 'text-fg hover:bg-surface-2',
  danger: 'bg-danger/10 text-danger hover:bg-danger/15',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-[13px] gap-1.5',
  md: 'h-10 px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Trailing arrow that nudges right on hover. */
  arrow?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, arrow, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'group/btn inline-flex items-center justify-center rounded-full font-medium tracking-[-0.01em] whitespace-nowrap transition-[background-color,color,filter,opacity] duration-200 select-none cursor-pointer active:scale-[0.98]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg',
        'disabled:pointer-events-none disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
      {arrow && !loading && <ArrowRight aria-hidden className={cn('-mr-0.5 shrink-0 transition-transform duration-300 ease-out group-hover/btn:translate-x-0.5', size === 'lg' ? 'size-4.5' : 'size-4')} />}
    </button>
  );
});

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl bg-surface', className)}>{children}</div>;
}

type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'accent' | 'volt';
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  brand: 'bg-brand/12 text-brand',
  success: 'bg-success/12 text-success',
  warn: 'bg-warn/14 text-warn',
  danger: 'bg-danger/12 text-danger',
  accent: 'bg-accent/12 text-accent',
  volt: 'bg-volt text-black',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Label({ children, hint, htmlFor }: { children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 flex items-baseline justify-between gap-3 text-sm font-medium text-fg">
      <span>{children}</span>
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

const fieldClass =
  'w-full rounded-xl border-0 bg-surface-2 px-4 text-[15px] text-fg placeholder:text-muted transition-[background-color,box-shadow] duration-200 hover:bg-surface-3 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-fg/15 disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldClass, 'h-11', className)} {...rest} />;
});

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, 'min-h-28 py-3 leading-relaxed', className)} {...rest} />;
}

/* Neutral mid-grey chevron that reads on both the light and dark surface-2 fills. */
const CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%238a867e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export function Select({ className, children, style, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(fieldClass, 'h-11 cursor-pointer appearance-none pr-10', className)}
      // Chevron sizing lives inline: tailwind-merge would read bg-[length:…]/bg-[right_…] as colours and drop bg-surface-2.
      style={{ backgroundImage: CHEVRON, backgroundSize: '16px', backgroundPosition: 'right 14px center', backgroundRepeat: 'no-repeat', ...style }}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-2 [animation-duration:1.8s]', className)} />;
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
    <div className={cn('inline-flex rounded-full bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'relative rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-200 cursor-pointer',
            value === o.value ? 'text-bg' : 'text-muted hover:text-fg',
          )}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${options.map((x) => x.value).join()}`} className="absolute inset-0 rounded-full bg-fg" transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }} />
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
        <motion.div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => dismissable && onClose()} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={cn('relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface sm:rounded-3xl', className)}
          >
            {dismissable && (
              <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full bg-surface-2 text-muted transition-colors hover:bg-surface-3 hover:text-fg cursor-pointer">
                <X className="size-4" />
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
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-5 grid size-14 place-items-center rounded-full bg-surface-2 text-muted">{icon}</div>
      <h3 className="font-display text-2xl font-medium">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** A number on the page, not in a box: small label, big display value, muted sub. */
export function Stat({ label, value, sub, icon, className }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-center gap-2 text-sm text-muted">
        {icon && <span className="grid shrink-0 place-items-center">{icon}</span>}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-3 truncate font-display text-4xl font-medium leading-none tracking-[-0.04em] tabular-nums">{value}</div>
      {sub && <div className="mt-2 text-sm text-muted">{sub}</div>}
    </div>
  );
}
