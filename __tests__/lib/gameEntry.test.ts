import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { __setAuthDisabled, __resetAuthModeDouble } from '../doubles/authMode';
import {
  __setInstallationId,
  __resetDeviceInstallationDouble,
} from '../doubles/deviceInstallation';
import {
  abandonGameEntry,
  adjustGameEntryReservation,
  consumeGameEntry,
  refundGameEntry,
  reserveGameEntry,
} from '@/lib/wallet/gameEntry';

describe('gameEntry wallet helpers', () => {
  beforeEach(() => {
    __resetAuthModeDouble();
    __resetDeviceInstallationDouble();
    __setInstallationId('device_test_1');
    __setAuthDisabled(false);
  });

  it('returns a local dummy reservation when auth is disabled', async () => {
    __setAuthDisabled(true);
    const mutation = jest.fn();

    // SAFETY: Test supplies a spy mutation with the reserve signature.
    const result = await reserveGameEntry(mutation as never, {
      mode: 'classic',
      clientSessionId: 'play_123',
      cost: 10,
    });

    expect(result).toEqual({ ok: true, reservationId: 'local_play_123' });
    expect(mutation).not.toHaveBeenCalled();
  });

  it('forwards reserve mutations when auth is enabled', async () => {
    const mutation = jest.fn(async () => ({
      ok: true,
      reservationId: 'user:play_123',
      balance: 90,
    }));

    // SAFETY: Test supplies a spy mutation with the reserve signature.
    const result = await reserveGameEntry(mutation as never, {
      mode: 'quickPlay',
      clientSessionId: 'play_123',
      cost: 5,
    });

    expect(result).toEqual({ ok: true, reservationId: 'user:play_123' });
    expect(mutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'quickPlay',
        clientSessionId: 'play_123',
        cost: 5,
        deviceId: 'device_test_1',
      })
    );
  });

  it('no-ops consume and refund when auth is disabled', async () => {
    __setAuthDisabled(true);
    const consumeMutation = jest.fn();
    const refundMutation = jest.fn();

    await expect(
      // SAFETY: Test supplies a spy mutation with the consume signature.
      consumeGameEntry(consumeMutation as never, {
        reservationId: 'local_play_123',
        completedSessionId: 'session-1',
      })
    ).resolves.toEqual({ ok: true });

    await expect(
      // SAFETY: Test supplies a spy mutation with the refund signature.
      refundGameEntry(refundMutation as never, {
        reservationId: 'local_play_123',
        reason: 'user_abandoned',
      })
    ).resolves.toEqual({ ok: true });

    expect(consumeMutation).not.toHaveBeenCalled();
    expect(refundMutation).not.toHaveBeenCalled();
  });

  it('skips adjust when auth is disabled or delta is zero', async () => {
    __setAuthDisabled(true);
    const mutation = jest.fn();

    await expect(
      // SAFETY: Test supplies a spy mutation with the adjust signature.
      adjustGameEntryReservation(mutation as never, {
        reservationId: 'user:play_123',
        additionalCost: 3,
      })
    ).resolves.toEqual({ ok: true });
    expect(mutation).not.toHaveBeenCalled();

    __setAuthDisabled(false);
    await expect(
      // SAFETY: Test supplies a spy mutation with the adjust signature.
      adjustGameEntryReservation(mutation as never, {
        reservationId: 'user:play_123',
        additionalCost: 0,
      })
    ).resolves.toEqual({ ok: true });
    expect(mutation).not.toHaveBeenCalled();
  });

  it('forwards adjust mutations when auth is enabled', async () => {
    const mutation = jest.fn(async () => ({ ok: true, balance: 82 }));

    // SAFETY: Test supplies a spy mutation with the adjust signature.
    const result = await adjustGameEntryReservation(mutation as never, {
      reservationId: 'user:play_123',
      additionalCost: 3,
    });

    expect(result).toEqual({ ok: true, balance: 82 });
    expect(mutation).toHaveBeenCalledWith({
      reservationId: 'user:play_123',
      additionalCost: 3,
    });
  });

  it('abandonGameEntry refunds then resets session', async () => {
    const refundMutation = jest.fn(async () => ({ ok: true, balance: 100 }));
    const resetSession = jest.fn();

    // SAFETY: Test supplies a spy mutation with the refund signature.
    await abandonGameEntry(refundMutation as never, {
      reservationId: 'user:play_123',
      reason: 'user_abandoned',
      resetSession,
    });

    expect(refundMutation).toHaveBeenCalledWith({
      reservationId: 'user:play_123',
      reason: 'user_abandoned',
    });
    expect(resetSession).toHaveBeenCalled();
  });

  it('abandonGameEntry skips refund when reservation is missing', async () => {
    const refundMutation = jest.fn();
    const resetSession = jest.fn();

    // SAFETY: Test supplies a spy mutation with the refund signature.
    await abandonGameEntry(refundMutation as never, {
      reservationId: null,
      reason: 'user_abandoned',
      resetSession,
    });

    expect(refundMutation).not.toHaveBeenCalled();
    expect(resetSession).toHaveBeenCalled();
  });
});
