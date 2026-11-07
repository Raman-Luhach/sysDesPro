/** Domain events: facts that already happened. Consumers react; producers don't know them. */
export interface SlotSoldEvent {
  type: 'SLOT_SOLD';
  payload: {
    slotId: string;
    bookingId: string;
    title: string;
    businessName: string;
    buyerId: string;
    merchantUserId: string;
    pricePaid: number;
    basePrice: number;
    startsAt: string;
  };
}

export interface SlotExpiredEvent {
  type: 'SLOT_EXPIRED';
  payload: { slotId: string; title: string; merchantUserId: string };
}

export type DomainEvent = SlotSoldEvent | SlotExpiredEvent;
export type DomainEventType = DomainEvent['type'];
export type EventOf<T extends DomainEventType> = Extract<DomainEvent, { type: T }>;
