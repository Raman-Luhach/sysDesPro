import { animate, AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { cn, inr } from '../lib/format';

/**
 * Rolls smoothly between prices and flashes green when the price drops.
 * With `showDrop`, also pops a "−₹12" chip (used on the big detail-page price).
 */
export function AnimatedPrice({ value, className, showDrop = false }: { value: number; className?: string; showDrop?: boolean }) {
  const [display, setDisplay] = useState(value);
  const [drop, setDrop] = useState<{ amount: number; key: number } | null>(null);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    if (from === value) return;
    prev.current = value;
    if (value < from) setDrop({ amount: from - value, key: Date.now() });
    const controls = animate(from, value, { duration: 0.7, ease: 'easeOut', onUpdate: (v) => setDisplay(v) });
    return () => controls.stop();
  }, [value]);

  useEffect(() => {
    if (!drop) return;
    const t = setTimeout(() => setDrop(null), 1200);
    return () => clearTimeout(t);
  }, [drop]);

  return (
    <span className="relative inline-flex items-baseline">
      <span className={cn('tabular-nums transition-colors duration-500', drop && 'text-success', className)}>{inr(Math.round(display / 100) * 100)}</span>
      <AnimatePresence>
        {showDrop && drop && (
          <motion.span
            key={drop.key}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute -top-5 right-0 whitespace-nowrap rounded-full bg-volt px-2 py-0.5 font-mono text-[11px] font-medium leading-4 tracking-normal text-black"
          >
            −{inr(drop.amount)}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
