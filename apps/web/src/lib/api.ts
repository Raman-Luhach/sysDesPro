import type {
  AppNotification,
  Booking,
  Business,
  Category,
  CurvePoint,
  Hold,
  MerchantStats,
  PaymentMethod,
  Slot,
  StampedeMode,
  StampedeResult,
  StrategyDescriptor,
  StrategyKind,
  User,
} from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const TOKEN_KEY = 'flashslot-token';

export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string | null) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

async function request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Is the API running?');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'ERROR', data.message ?? 'Request failed');
  return data as T;
}

export interface CreateSlotInput {
  title: string;
  description: string;
  startsAt: string;
  durationMin: number;
  basePrice: number;
  floorPrice: number;
  strategy: StrategyKind;
  strategyParams: Record<string, number>;
  publishNow: boolean;
}

export const api = {
  login: (email: string, password: string) => request<{ token: string; user: User }>('POST', '/auth/login', { email, password }),
  register: (input: { name: string; email: string; password: string; role: 'CUSTOMER' | 'MERCHANT' }) =>
    request<{ token: string; user: User }>('POST', '/auth/register', input),
  me: () => request<User>('GET', '/auth/me'),

  feed: (q: { category?: Category; city?: string; sort?: string }) => {
    const p = new URLSearchParams();
    if (q.category) p.set('category', q.category);
    if (q.city) p.set('city', q.city);
    if (q.sort) p.set('sort', q.sort);
    const qs = p.toString();
    return request<Slot[]>('GET', `/slots${qs ? `?${qs}` : ''}`);
  },
  cities: () => request<string[]>('GET', '/slots/cities'),
  slot: (id: string) => request<{ slot: Slot; curve: CurvePoint[] }>('GET', `/slots/${id}`),

  hold: (id: string) => request<Hold>('POST', `/slots/${id}/hold`),
  release: (id: string) => request<void>('POST', `/slots/${id}/release`),
  checkout: (id: string, paymentMethod: PaymentMethod, idempotencyKey: string) =>
    request<Booking>('POST', `/slots/${id}/checkout`, { paymentMethod }, { 'Idempotency-Key': idempotencyKey }),
  myBookings: () => request<Booking[]>('GET', '/bookings/me'),

  strategies: () => request<StrategyDescriptor[]>('GET', '/pricing/strategies'),
  previewCurve: (input: {
    strategy: StrategyKind;
    strategyParams: Record<string, number>;
    basePrice: number;
    floorPrice: number;
    liveAt: string;
    startsAt: string;
  }) => request<{ points: CurvePoint[] }>('POST', '/pricing/preview', { ...input, points: 60 }),

  myBusiness: () => request<{ business: Business | null }>('GET', '/business/me'),
  saveBusiness: (b: Omit<Business, 'id'>) => request<Business>('PUT', '/business/me', b),
  dashboard: () => request<{ business: Business; stats: MerchantStats; slots: Slot[] }>('GET', '/business/me/dashboard'),
  createSlot: (input: CreateSlotInput) => request<Slot>('POST', '/slots', input),
  publishSlot: (id: string) => request<Slot>('POST', `/slots/${id}/publish`),
  cancelSlot: (id: string) => request<Slot>('POST', `/slots/${id}/cancel`),

  notifications: () => request<AppNotification[]>('GET', '/notifications'),
  readAllNotifications: () => request<void>('POST', '/notifications/read-all'),

  stampede: (buyers: number, mode: StampedeMode) => request<StampedeResult>('POST', '/demo/stampede', { buyers, mode }),
  spawnDeals: () => request<{ created: number }>('POST', '/demo/spawn-deals'),
  system: () => request<{ instance: string; isLeader: boolean; holdTtlSeconds: number }>('GET', '/demo/system'),
};
