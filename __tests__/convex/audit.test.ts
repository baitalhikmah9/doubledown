import { describe, expect, it, jest } from '@jest/globals';
import { writeAudit } from '@/convex/lib/audit';

type AuditDoc = {
  actorUserId?: string;
  actorEmail?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
  before?: { balance?: number; code?: string };
  after?: { balance?: number; code?: string };
  timestamp?: number;
};
type AuditInsertArgs = [table: string, doc: AuditDoc];

describe('writeAudit', () => {
  it('writes an append-only audit record with actor, action, target, reason, and snapshots', async () => {
    const insert = jest.fn<(...args: AuditInsertArgs) => Promise<string>>(async () => 'audit_1');
    // SAFETY: Minimal ctx stub matches writeAudit's db.insert usage.
    const ctx = { db: { insert } } as never;
    const now = Date.now();

    await writeAudit(ctx, {
      // SAFETY: Test fixture branded as Id<'users'>.
      actorUserId: 'user_1' as never,
      actorEmail: 'admin@example.com',
      action: 'wallet.adjust',
      targetType: 'wallet',
      targetId: 'wallet_1',
      reason: 'compensation',
      before: { balance: 10 },
      after: { balance: 15 },
    });

    expect(insert).toHaveBeenCalledTimes(1);
    const call = insert.mock.calls[0];
    expect(call?.[0]).toBe('admin_audit_log');
    // SAFETY: insert spy was typed to receive AuditDoc.
    const record = call?.[1] as AuditDoc;
    expect(record.actorUserId).toBe('user_1');
    expect(record.actorEmail).toBe('admin@example.com');
    expect(record.action).toBe('wallet.adjust');
    expect(record.targetType).toBe('wallet');
    expect(record.targetId).toBe('wallet_1');
    expect(record.reason).toBe('compensation');
    expect(record.before).toEqual({ balance: 10 });
    expect(record.after).toEqual({ balance: 15 });
    expect(record.timestamp).toBeGreaterThanOrEqual(now - 5);
    expect(record.timestamp).toBeLessThanOrEqual(Date.now() + 5);
  });

  it('omits optional reason when not provided', async () => {
    const insert = jest.fn<(...args: AuditInsertArgs) => Promise<string>>(async () => 'audit_2');
    // SAFETY: Minimal ctx stub matches writeAudit's db.insert usage.
    const ctx = { db: { insert } } as never;

    await writeAudit(ctx, {
      // SAFETY: Test fixture branded as Id<'users'>.
      actorUserId: 'user_1' as never,
      action: 'promo.create',
      targetType: 'promo_code',
      targetId: 'promo_1',
      after: { code: 'test' },
    });

    // SAFETY: insert spy was typed to receive AuditDoc.
    const record = insert.mock.calls[0]?.[1] as AuditDoc;
    expect(record.reason).toBeUndefined();
  });
});
