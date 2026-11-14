export type Role = 'CUSTOMER' | 'MERCHANT' | 'ADMIN';
export type Category = 'SALON' | 'FITNESS' | 'DINING' | 'WELLNESS' | 'ENTERTAINMENT' | 'CLASSES';
export type SlotStatus = 'DRAFT' | 'LIVE' | 'HELD' | 'SOLD' | 'EXPIRED' | 'CANCELLED';
export type StrategyKind = 'LINEAR' | 'STEP' | 'EXPONENTIAL';
export type PaymentMethod = 'UPI' | 'CARD' | 'WALLET';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  hasBusiness: boolean;
}

export interface Slot {
  id: string;
  title: string;
  description: string;
  category: Category;
  business: { id: string; name: string; city: string; address: string };
  startsAt: string;
  durationMin: number;
  basePrice: number;
  floorPrice: number;
  currentPrice: number;
  discountPct: number;
  strategy: StrategyKind;
  strategyParams: Record<string, number>;
  status: SlotStatus;
  liveAt: string | null;
  nextDropAt: string | null;
  holdExpiresAt: string | null;
  soldPrice: number | null;
  viewers: number;
  myHold: { price: number; expiresAt: string } | null;
}

export interface CurvePoint {
  at: string;
  price: number;
}

export interface Hold {
  slotId: string;
  price: number;
  expiresAt: string;
}

export interface Booking {
  id: string;
  code: string;
  slotId: string;
  title: string;
  businessName: string;
  address: string;
  startsAt: string;
  durationMin: number;
  pricePaid: number;
  originalPrice: number;
  paymentRef: string;
  paymentMethod: string;
  createdAt: string;
}

export interface Business {
  id: string;
  name: string;
  category: Category;
  city: string;
  address: string;
  description: string;
}

export interface MerchantStats {
  revenue: number;
  soldCount: number;
  liveCount: number;
  unsoldCount: number;
  avgDiscountPct: number;
  sellThroughPct: number;
}

export interface StrategyDescriptor {
  kind: StrategyKind;
  label: string;
  description: string;
  params: Array<{ key: string; label: string; min: number; max: number; default: number }>;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export type StampedeMode = 'safe' | 'db-only' | 'naive';
export type Outcome = 'WON' | 'REJECTED_GATE' | 'REJECTED_STATE' | 'REJECTED_DB' | 'ERROR';

export interface StampedeResult {
  mode: StampedeMode;
  buyers: number;
  slotId: string;
  servedBy: string;
  totalMs: number;
  winners: number;
  breakdown: { won: number; rejectedGate: number; rejectedState: number; rejectedDb: number; errors: number };
  latency: { p50: number; p95: number; max: number };
  finalStatus: SlotStatus;
  bookingsForSlot: number;
  booking: { code: string; pricePaid: number } | null;
  attempts: Array<{ buyer: number; outcome: Outcome; ms: number }>;
}
