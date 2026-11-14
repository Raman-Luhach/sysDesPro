import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { activity, livePrices, liveViewers } from '../lib/live-store';
import type { AppNotification, Slot } from '../lib/types';
import { useAuth } from './auth';

interface RealtimeState {
  connected: boolean;
  watch: (slotId: string) => () => void;
}

const RealtimeContext = createContext<RealtimeState>({ connected: false, watch: () => () => {} });

/** Patch a slot inside every cached feed list so cards update instantly (no refetch). */
function patchFeeds(qc: QueryClient, slot: Slot): Slot | undefined {
  let previous: Slot | undefined;
  qc.setQueriesData<Slot[]>({ queryKey: ['feed'] }, (list) => {
    if (!list) return list;
    const i = list.findIndex((s) => s.id === slot.id);
    if (i === -1) return list;
    previous ??= list[i];
    const next = list.slice();
    next[i] = { ...slot, myHold: list[i].myHold };
    return next;
  });
  // A newly published slot isn't in any list yet: refetch.
  if (!previous && (slot.status === 'LIVE' || slot.status === 'HELD')) qc.invalidateQueries({ queryKey: ['feed'] });
  return previous;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const watching = useRef(new Map<string, number>());

  useEffect(() => {
    let socket: Socket | null = null;
    // Deferred so React StrictMode's mount→unmount→mount in dev doesn't open a socket
    // and immediately kill it (which logs a noisy "WebSocket closed" warning).
    const timer = setTimeout(() => {
      socket = io({ path: '/socket.io', transports: ['websocket'], auth: { token } });
      socketRef.current = socket;

      socket.on('connect', () => {
        setConnected(true);
        for (const id of watching.current.keys()) socket!.emit('slot:watch', { slotId: id });
      });
      socket.on('disconnect', () => setConnected(false));

      socket.on('prices', (msg: { prices: Record<string, number> }) => {
        for (const [id, price] of Object.entries(msg.prices)) livePrices.set(id, price);
      });

      socket.on('viewers', (msg: { slotId: string; count: number }) => liveViewers.set(msg.slotId, msg.count));

      socket.on('slot:update', (slot: Slot) => {
        if (slot.status === 'LIVE' || slot.status === 'HELD') livePrices.set(slot.id, slot.currentPrice);
        const prev = patchFeeds(qc, slot);
        if (slot.status === 'SOLD' && prev?.status !== 'SOLD') {
          activity.push({ kind: 'sold', title: slot.title, business: slot.business.name, price: slot.soldPrice ?? slot.currentPrice });
        } else if (slot.status === 'LIVE' && !prev) {
          activity.push({ kind: 'new', title: slot.title, business: slot.business.name, price: slot.currentPrice });
        } else if (slot.status === 'HELD' && prev?.status === 'LIVE') {
          activity.push({ kind: 'held', title: slot.title, business: slot.business.name, price: slot.currentPrice });
        }
        qc.invalidateQueries({ queryKey: ['slot', slot.id] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
      });

      socket.on('notification', (n: AppNotification) => {
        toast(n.title, { description: n.body });
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['bookings'] });
      });
    }, 0);

    return () => {
      clearTimeout(timer);
      socket?.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, qc]);

  const watch = useCallback((slotId: string) => {
    const n = watching.current.get(slotId) ?? 0;
    watching.current.set(slotId, n + 1);
    if (n === 0) socketRef.current?.emit('slot:watch', { slotId });
    return () => {
      const left = (watching.current.get(slotId) ?? 1) - 1;
      if (left <= 0) {
        watching.current.delete(slotId);
        socketRef.current?.emit('slot:unwatch', { slotId });
      } else watching.current.set(slotId, left);
    };
  }, []);

  return <RealtimeContext.Provider value={{ connected, watch }}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);
