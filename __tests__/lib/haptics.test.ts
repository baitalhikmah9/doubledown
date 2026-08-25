import { afterEach, describe, expect, it } from '@jest/globals';
import { Platform } from 'react-native';

import { impactAsync } from '../doubles/expoHaptics';
import { hapticButtonPress } from '@/lib/haptics';

describe('hapticButtonPress', () => {
  afterEach(() => {
    impactAsync.mockReset();
    impactAsync.mockResolvedValue(undefined);
  });

  it('does not throw when the native haptics call fails synchronously', () => {
    if (Platform.OS === 'web') {
      return;
    }

    impactAsync.mockImplementation(() => {
      throw new Error('Native haptics unavailable');
    });

    expect(() => hapticButtonPress()).not.toThrow();
  });
});
