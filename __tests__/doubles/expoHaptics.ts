/** Controllable expo-haptics double. */

export const ImpactFeedbackStyle = {
  Light: 'Light',
  Medium: 'Medium',
  Heavy: 'Heavy',
  Rigid: 'Rigid',
  Soft: 'Soft',
} as const;

export const NotificationFeedbackType = {
  Success: 'Success',
  Warning: 'Warning',
  Error: 'Error',
} as const;

export const impactAsync = jest.fn(async () => undefined);
export const notificationAsync = jest.fn(async () => undefined);
export const selectionAsync = jest.fn(async () => undefined);

export function __resetExpoHapticsDouble(): void {
  impactAsync.mockReset();
  impactAsync.mockResolvedValue(undefined);
  notificationAsync.mockReset();
  notificationAsync.mockResolvedValue(undefined);
  selectionAsync.mockReset();
  selectionAsync.mockResolvedValue(undefined);
}
