/** Controllable `@/lib/haptics` double. */

export const hapticButtonPress = jest.fn(() => undefined);
export const hapticTick = jest.fn(() => undefined);
export const hapticSuccess = jest.fn(() => undefined);

export function __resetHapticsDouble(): void {
  hapticButtonPress.mockClear();
  hapticTick.mockClear();
  hapticSuccess.mockClear();
}
