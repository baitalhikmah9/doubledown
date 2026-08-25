/**
 * Pure helpers for the account-deletion lifecycle.
 * DB work lives in convex/users.ts; these stay unit-testable.
 */

export const PURCHASER_STATE_DELETED = 'deleted';
export const PURCHASER_STATE_ACTIVE = 'active';
export const PURCHASER_STATE_MERGED = 'merged';

export const ACCOUNT_DELETION_FORFEIT_SOURCE = 'account_deletion';
export const ACCOUNT_DELETION_FORFEIT_TYPE = 'account_deletion_forfeit';

export function isUserDeletionPending(user: {
  deletionPendingAt?: number;
}): boolean {
  return user.deletionPendingAt != null;
}

/** Active purchaser accounts may still be used; merged/deleted may not. */
export function isPurchaserAccountUsable(account: { state: string }): boolean {
  return account.state === PURCHASER_STATE_ACTIVE;
}

/**
 * Deleted or merged purchaser accounts must never be reclaimed by a new or
 * returning user identity.
 */
export function isPurchaserAccountReclaimable(account: { state: string }): boolean {
  return account.state === PURCHASER_STATE_ACTIVE;
}

/** Fields wiped when deletion begins (PII / preferences). clerkId kept until finalize. */
export type AccountDeletionPiiPatch = {
  deletionPendingAt: number;
  email: undefined;
  name: undefined;
  preferences: undefined;
  role: undefined;
  lastActiveAt: number;
};

export function buildAccountDeletionPiiPatch(now: number): AccountDeletionPiiPatch {
  return {
    deletionPendingAt: now,
    email: undefined,
    name: undefined,
    preferences: undefined,
    role: undefined,
    lastActiveAt: now,
  };
}

/** Purchaser-account patch after unlink + forfeit. */
export type DeletedPurchaserAccountPatch = {
  state: typeof PURCHASER_STATE_DELETED;
  linkedUserId: undefined;
  lastSeenAt: number;
};

export function buildDeletedPurchaserAccountPatch(now: number): DeletedPurchaserAccountPatch {
  return {
    state: PURCHASER_STATE_DELETED,
    linkedUserId: undefined,
    lastSeenAt: now,
  };
}

export type DeviceUnlinkPatch = {
  userId: undefined;
  purchaserAccountId: undefined;
};

export function buildDeviceUnlinkPatch(): DeviceUnlinkPatch {
  return {
    userId: undefined,
    purchaserAccountId: undefined,
  };
}

export type WalletForfeitTransactionDraft = {
  type: typeof ACCOUNT_DELETION_FORFEIT_TYPE;
  amount: number;
  source: typeof ACCOUNT_DELETION_FORFEIT_SOURCE;
  createdAt: number;
  status: 'posted';
  idempotencyKey: string;
  metadata: { clerkId: string; userId: string };
};

export function buildWalletForfeitTransaction(args: {
  walletId: string;
  amount: number;
  now: number;
  clerkId: string;
  userId: string;
}): WalletForfeitTransactionDraft {
  return {
    type: ACCOUNT_DELETION_FORFEIT_TYPE,
    amount: -Math.abs(args.amount),
    source: ACCOUNT_DELETION_FORFEIT_SOURCE,
    createdAt: args.now,
    status: 'posted',
    idempotencyKey: `account_deletion_forfeit:${args.userId}`,
    metadata: {
      clerkId: args.clerkId,
      userId: args.userId,
    },
  };
}

/** Clerk Management API: treat 404 as already deleted (idempotent retry). */
export function isClerkUserAlreadyDeleted(status: number): boolean {
  return status === 404;
}
