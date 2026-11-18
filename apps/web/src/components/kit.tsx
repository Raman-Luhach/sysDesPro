import { animate, motion, useInView } from 'framer-motion';
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../lib/format';

/** House easing: fast start, long soft landing. */
export const EASE = [0.16, 1, 0.3, 1] as const;

const VIEWPORT = { once: true, margin: '0px 0px -10% 0px' } as const;

/** Editorial section label: "■ LIVE DEALS". */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted', className)}>
      <span aria-hidden className="size-2 shrink-0 bg-fg" />
      {children}
    </div>
  );
}

/** Fades and lifts its children in the first time they scroll into view. */
export function Reveal({ children, className, delay = 0, y = 24 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={VIEWPORT} transition={{ duration: 0.8, ease: EASE, delay }}>
      {children}
    </motion.div>
  );
}

/** Headline reveal: each word slides up out of a mask, staggered. Wraps normally. */
export function RevealWords({ text, className, delay = 0, stagger = 0.05 }: { text: string; className?: string; delay?: number; stagger?: number }) {
  const words = text.split(' ');
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span aria-hidden className="inline-block overflow-hidden pb-[0.1em] -mb-[0.1em] align-bottom">
            <motion.span className="inline-block" initial={{ y: '110%' }} whileInView={{ y: '0%' }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE, delay: delay + i * stagger }}>
              {w}
            </motion.span>
          </span>
          {i < words.length - 1 && ' '}
        </Fragment>
      ))}
    </span>
  );
}

/** Counts up to `to` once visible; later changes animate from the previous value. */
export function CountUp({ to, duration = 1.4, format = (n: number) => Math.round(n).toLocaleString('en-IN'), className }: { to: number; duration?: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, VIEWPORT);
  const [value, setValue] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(from.current, to, { duration, ease: EASE, onUpdate: setValue });
    from.current = to;
    return () => controls.stop();
  }, [inView, to, duration]);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {format(value)}
    </span>
  );
}

/** Infinite horizontal ticker. Children are rendered twice for a seamless loop. */
export function Marquee({ children, className, duration = 40, reverse = false }: { children: ReactNode; className?: string; duration?: number; reverse?: boolean }) {
  const style = { '--marquee-duration': `${duration}s`, animationDirection: reverse ? 'reverse' : undefined } as CSSProperties;
  return (
    <div className={cn('flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]', className)}>
      <div className="flex shrink-0 animate-marquee items-center" style={style}>
        <div className="flex shrink-0 items-center">{children}</div>
        <div aria-hidden className="flex shrink-0 items-center">
          {children}
        </div>
      </div>
    </div>
  );
}
