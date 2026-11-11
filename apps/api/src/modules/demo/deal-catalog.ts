import type { Category, PricingStrategyKind } from '@prisma/client';

/** Sample data shared by the seed script and the "spawn fresh deals" demo button. */
export interface BusinessSeed {
  key: string;
  name: string;
  category: Category;
  city: string;
  address: string;
  description: string;
  ownerEmail: string;
  ownerName: string;
}

export interface DealTemplate {
  businessKey: string;
  title: string;
  description: string;
  durationMin: number;
  /** Rupees. */
  base: number;
  floor: number;
  strategy: PricingStrategyKind;
  params?: Record<string, number>;
}

export const BUSINESSES: BusinessSeed[] = [
  {
    key: 'glow',
    name: 'Glow Studio',
    category: 'SALON',
    city: 'Bengaluru',
    address: '12th Main, Indiranagar',
    description: 'Premium hair & skin studio. Cancellations become your deals.',
    ownerEmail: 'merchant@flashslot.dev',
    ownerName: 'Priya (Glow Studio)',
  },
  {
    key: 'ironhouse',
    name: 'Iron House Gym',
    category: 'FITNESS',
    city: 'Bengaluru',
    address: '80 Feet Rd, Koramangala',
    description: 'Personal training & group classes.',
    ownerEmail: 'ironhouse@flashslot.dev',
    ownerName: 'Arjun (Iron House)',
  },
  {
    key: 'saffron',
    name: 'Saffron Table',
    category: 'DINING',
    city: 'Mumbai',
    address: 'Linking Rd, Bandra West',
    description: "Chef's tasting tables that would otherwise sit empty.",
    ownerEmail: 'saffron@flashslot.dev',
    ownerName: 'Meera (Saffron Table)',
  },
  {
    key: 'stillwater',
    name: 'Stillwater Spa',
    category: 'WELLNESS',
    city: 'Mumbai',
    address: 'Hill Rd, Bandra',
    description: 'Massages and therapies, last-minute openings.',
    ownerEmail: 'stillwater@flashslot.dev',
    ownerName: 'Kabir (Stillwater)',
  },
  {
    key: 'arcade',
    name: 'Pixel Arcade',
    category: 'ENTERTAINMENT',
    city: 'Delhi',
    address: 'Hauz Khas Village',
    description: 'VR rooms, bowling lanes and escape rooms.',
    ownerEmail: 'arcade@flashslot.dev',
    ownerName: 'Rohan (Pixel Arcade)',
  },
  {
    key: 'clayroom',
    name: 'The Clay Room',
    category: 'CLASSES',
    city: 'Delhi',
    address: 'Shahpur Jat',
    description: 'Pottery, painting and baking workshops.',
    ownerEmail: 'clayroom@flashslot.dev',
    ownerName: 'Ananya (Clay Room)',
  },
];

export const DEAL_TEMPLATES: DealTemplate[] = [
  { businessKey: 'glow', title: 'Signature Haircut & Blow-dry', description: 'Wash, precision cut and styling with a senior stylist.', durationMin: 60, base: 1800, floor: 799, strategy: 'LINEAR' },
  { businessKey: 'glow', title: 'Hydra Facial', description: 'Deep cleanse, exfoliation and hydration. Leaves skin glowing.', durationMin: 75, base: 3500, floor: 1499, strategy: 'EXPONENTIAL', params: { steepness: 3 } },
  { businessKey: 'glow', title: 'Gel Manicure', description: 'Long-lasting gel polish with cuticle care.', durationMin: 45, base: 1200, floor: 499, strategy: 'STEP', params: { steps: 6 } },
  { businessKey: 'ironhouse', title: '1:1 Personal Training', description: 'A full session with a certified coach, tailored to you.', durationMin: 60, base: 1500, floor: 499, strategy: 'STEP', params: { steps: 8 } },
  { businessKey: 'ironhouse', title: 'Reformer Pilates (1 spot)', description: 'Small-group reformer class, one spot opened up.', durationMin: 50, base: 1100, floor: 399, strategy: 'LINEAR' },
  { businessKey: 'ironhouse', title: 'Boxing Fundamentals', description: 'Pads, footwork and conditioning with a pro.', durationMin: 60, base: 1300, floor: 450, strategy: 'EXPONENTIAL', params: { steepness: 4 } },
  { businessKey: 'saffron', title: "Chef's Table for 2", description: '7-course tasting menu at the counter, watch the kitchen live.', durationMin: 120, base: 6000, floor: 2999, strategy: 'EXPONENTIAL', params: { steepness: 3 } },
  { businessKey: 'saffron', title: 'Window Table Dinner for 4', description: 'Prime window table, ₹ shown is the cover charge credited to your bill.', durationMin: 90, base: 2500, floor: 899, strategy: 'STEP', params: { steps: 5 } },
  { businessKey: 'stillwater', title: 'Deep Tissue Massage', description: 'Firm-pressure therapy for knots and tension.', durationMin: 60, base: 3200, floor: 1299, strategy: 'LINEAR' },
  { businessKey: 'stillwater', title: 'Couples Aroma Therapy', description: 'Side-by-side massage in the private suite.', durationMin: 90, base: 7000, floor: 2999, strategy: 'EXPONENTIAL', params: { steepness: 5 } },
  { businessKey: 'arcade', title: 'VR Arena (4 players)', description: 'Free-roam VR battle for up to four.', durationMin: 45, base: 2400, floor: 799, strategy: 'STEP', params: { steps: 6 } },
  { businessKey: 'arcade', title: 'Escape Room: The Vault', description: 'Our hardest room. 60 minutes. Up to 6 people.', durationMin: 60, base: 3000, floor: 999, strategy: 'LINEAR' },
  { businessKey: 'arcade', title: 'Bowling Lane (1 hr)', description: 'Private lane with shoes for up to 6.', durationMin: 60, base: 1600, floor: 599, strategy: 'EXPONENTIAL', params: { steepness: 2 } },
  { businessKey: 'clayroom', title: 'Wheel Throwing Taster', description: 'Make your first bowl on the wheel. All materials included.', durationMin: 120, base: 2200, floor: 899, strategy: 'STEP', params: { steps: 4 } },
  { businessKey: 'clayroom', title: 'Sourdough Workshop', description: 'Take home a starter and your own loaf.', durationMin: 150, base: 2800, floor: 1199, strategy: 'LINEAR' },
];
