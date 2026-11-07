import type { SlotStatus } from '@prisma/client';

/** The fields that decide a slot's lifecycle state. */
export interface SlotLifecycleFields {
  status: SlotStatus;
  startsAt: Date;
  holdUserId: string | null;
  holdExpiresAt: Date | null;
}

/**
 * STATE pattern. Each lifecycle state decides which actions are legal, so services ask
 * `state.canHold()` instead of scattering `if (status === ...)` checks everywhere.
 *
 *   DRAFT --publish--> LIVE --hold--> HELD --pay--> SOLD
 *                       ^               |
 *                       +--hold expires-+
 *   LIVE/HELD/DRAFT --start time passes--> EXPIRED      DRAFT/LIVE --cancel--> CANCELLED
 */
export abstract class SlotState {
  abstract readonly status: SlotStatus;
  canPublish(): boolean {
    return false;
  }
  canHold(): boolean {
    return false;
  }
  canConfirm(_userId: string): boolean {
    return false;
  }
  canCancel(): boolean {
    return false;
  }
  isHeldBy(_userId: string): boolean {
    return false;
  }
}

class DraftState extends SlotState {
  readonly status = 'DRAFT' as const;
  override canPublish() {
    return true;
  }
  override canCancel() {
    return true;
  }
}

class LiveState extends SlotState {
  readonly status = 'LIVE' as const;
  override canHold() {
    return true;
  }
  override canCancel() {
    return true;
  }
}

class HeldState extends SlotState {
  readonly status = 'HELD' as const;
  constructor(private readonly holderId: string) {
    super();
  }
  override canConfirm(userId: string) {
    return userId === this.holderId;
  }
  override isHeldBy(userId: string) {
    return userId === this.holderId;
  }
}

class TerminalState extends SlotState {
  constructor(readonly status: SlotStatus) {
    super();
  }
}

export class SlotStateResolver {
  /**
   * Resolve the *effective* state at `now`. Time-based transitions are applied lazily:
   * an expired hold already counts as LIVE and a past start time as EXPIRED, even before
   * the background sweeper writes that to the database.
   */
  static resolve(slot: SlotLifecycleFields, now = new Date()): SlotState {
    switch (slot.status) {
      case 'SOLD':
      case 'CANCELLED':
      case 'EXPIRED':
        return new TerminalState(slot.status);
    }
    if (slot.startsAt.getTime() <= now.getTime()) return new TerminalState('EXPIRED');
    if (slot.status === 'DRAFT') return new DraftState();
    if (slot.status === 'HELD' && slot.holdUserId && slot.holdExpiresAt && slot.holdExpiresAt > now) {
      return new HeldState(slot.holdUserId);
    }
    return new LiveState();
  }
}
