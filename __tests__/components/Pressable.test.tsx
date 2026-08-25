import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { impactAsync } from '../doubles/expoHaptics';

describe('Pressable', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    impactAsync.mockClear();
    // Haptics are no-op on web; pin native so press feedback is exercised.
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  });

  it('triggers haptics by default', () => {
    render(
      <Pressable accessibilityRole="button">
        <Text>Tap</Text>
      </Pressable>
    );

    fireEvent(screen.getByRole('button'), 'pressIn');

    expect(impactAsync).toHaveBeenCalledTimes(1);
  });

  it('does not trigger haptics when explicitly disabled', () => {
    render(
      <Pressable accessibilityRole="button" hapticFeedback={false}>
        <Text>Tap</Text>
      </Pressable>
    );

    fireEvent(screen.getByRole('button'), 'pressIn');

    expect(impactAsync).not.toHaveBeenCalled();
  });

  it('triggers haptics when explicitly enabled', () => {
    render(
      <Pressable accessibilityRole="button" hapticFeedback>
        <Text>Tap</Text>
      </Pressable>
    );

    fireEvent(screen.getByRole('button'), 'pressIn');

    expect(impactAsync).toHaveBeenCalledTimes(1);
  });
});
