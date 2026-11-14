import { useSyncExternalStore } from 'react';

/**
 * Tiny external store for high-frequency realtime data (prices every 2s, viewer counts).
 * Kept outside React Query so a price tick only re-renders the components showing that
 * slot, not the whole feed.
 */
type Listener = () => void;

class KeyedStore<V> {
  private values = new Map<string, V>();
  private listeners = new Map<string, Set<Listener>>();

  get(key: string): V | undefined {
    return this.values.get(key);
  }

  set(key: string, value: V): void {
    if (this.values.get(key) === value) return;
    this.values.set(key, value);
    this.listeners.get(key)?.forEach((l) => l());
  }

  subscribe(key: string, l: Listener): () => void {
    let set = this.listeners.get(key);
    if (!set) this.listeners.set(key, (set = new Set()));
    set.add(l);
    return () => set!.delete(l);
  }
}

export const livePrices = new KeyedStore<number>();
export const liveViewers = new KeyedStore<number>();

export function useLivePrice(slotId: string, fallback: number): number {
  return useSyncExternalStore(
    (l) => livePrices.subscribe(slotId, l),
    () => livePrices.get(slotId) ?? fallback,
  );
}

export function useLiveViewers(slotId: string, fallback: number): number {
  return useSyncExternalStore(
    (l) => liveViewers.subscribe(slotId, l),
    () => liveViewers.get(slotId) ?? fallback,
  );
}

/** Shared 1-second clock for countdowns (one interval for the whole app). */
const clockListeners = new Set<Listener>();
let now = Date.now();
setInterval(() => {
  now = Date.now();
  clockListeners.forEach((l) => l());
}, 1000);

export function useNow(): number {
  return useSyncExternalStore(
    (l) => {
      clockListeners.add(l);
      return () => clockListeners.delete(l);
    },
    () => now,
  );
}

/** Recent marketplace activity ("just sold", "just listed") streamed from the socket. */
export interface ActivityItem {
  id: number;
  kind: 'sold' | 'new' | 'held';
  title: string;
  business: string;
  price: number;
  at: number;
}

class ActivityStore {
  private items: ActivityItem[] = [];
  private listeners = new Set<Listener>();
  private seq = 0;

  push(item: Omit<ActivityItem, 'id' | 'at'>): void {
    this.items = [{ ...item, id: ++this.seq, at: Date.now() }, ...this.items].slice(0, 12);
    this.listeners.forEach((l) => l());
  }

  snapshot = (): ActivityItem[] => this.items;

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}

export const activity = new ActivityStore();

export function useActivity(): ActivityItem[] {
  return useSyncExternalStore(activity.subscribe, activity.snapshot);
}
