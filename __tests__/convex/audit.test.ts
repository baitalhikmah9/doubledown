import { describe, expect, it, jest } from '@jest/globals';
import { writeAudit } from '@/convex/lib/audit';

describe('writeAudit', () => {
  it('writes an append-only audit record with actor, action, target, reason, and snapshots', async () => {
    const insert = jest.fn<(...args: unknown[]) => Promise<unknown>>();
    const ctx = { db: { insert } } as any;
    const now = Date.now();

    await writeAudit(ctx, {
      actorUserId: 'user_1' as any,
      actorEmail: 'admin@example.com',
      action: 'wallet.adjust',
      targetType: 'wallet',
      targetId: 'wallet_1',
      reason: 'compensation',
      before: { balance: 10 },
      after: { balance: 15 },
    });

    expect(insert).toHaveBeenCalledTimes(1);
    const record = insert.mock.calls[0][1] as any;
    expect(insert.mock.calls[0][0]).toBe('admin_audit_log');
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
    const insert = jest.fn<(...args: unknown[]) => Promise<unknown>>();
    const ctx = { db: { insert } } as any;

    await writeAudit(ctx, {
      actorUserId: 'user_1' as any,
      action: 'promo.create',
      targetType: 'promo_code',
      targetId: 'promo_1',
      after: { code: 'test' },
    });

    const record = insert.mock.calls[0][1] as any;
    expect(record.reason).toBeUndefined();
    expect(record.before).toBeUndefined();
  });
});
