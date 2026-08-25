import React from 'react';
import { Platform } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import {
  WebLandscapeGate,
  isWebPlayLandscapePath,
} from '@/components/WebLandscapeGate';
import { __setWindowDimensions } from '../doubles/windowDimensions';
import { __setPathname } from '../doubles/expoRouter';

describe('isWebPlayLandscapePath', () => {
  it('matches play and game surfaces only', () => {
    expect(isWebPlayLandscapePath('/play')).toBe(true);
    expect(isWebPlayLandscapePath('/play/board')).toBe(true);
    expect(isWebPlayLandscapePath('/(app)/play/question')).toBe(true);
    expect(isWebPlayLandscapePath('/game')).toBe(true);
    expect(isWebPlayLandscapePath('/(app)/game')).toBe(true);
    expect(isWebPlayLandscapePath('/game/recap')).toBe(true);

    expect(isWebPlayLandscapePath('/')).toBe(false);
    expect(isWebPlayLandscapePath('/(app)')).toBe(false);
    expect(isWebPlayLandscapePath('/create-game')).toBe(false);
    expect(isWebPlayLandscapePath('/(app)/create-game')).toBe(false);
    expect(isWebPlayLandscapePath('/login')).toBe(false);
    expect(isWebPlayLandscapePath('/admin')).toBe(false);
    expect(isWebPlayLandscapePath('/privacy')).toBe(false);
    expect(isWebPlayLandscapePath('/settings')).toBe(false);
    expect(isWebPlayLandscapePath('/delete-account')).toBe(false);
    expect(isWebPlayLandscapePath('/terms')).toBe(false);
  });
});

describe('WebLandscapeGate', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  });

  it('is a no-op on native', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    __setWindowDimensions({ width: 390, height: 844 });
    __setPathname('/play/board');

    const { toJSON } = render(<WebLandscapeGate />);
    expect(toJSON()).toBeNull();
  });

  it('blocks portrait web play routes', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    __setWindowDimensions({ width: 390, height: 844 });
    __setPathname('/play/board');

    render(<WebLandscapeGate />);
    expect(screen.getByText('Rotate your device')).toBeTruthy();
    expect(screen.getByText('Backfire plays in landscape only.')).toBeTruthy();
  });

  it('blocks portrait web game routes', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    __setWindowDimensions({ width: 390, height: 844 });
    __setPathname('/(app)/game');

    render(<WebLandscapeGate />);
    expect(screen.getByText('Rotate your device')).toBeTruthy();
  });

  it('does not block portrait web non-play routes (create-game / auth / legal / home)', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    __setWindowDimensions({ width: 390, height: 844 });

    for (const path of ['/login', '/create-game', '/(app)/create-game', '/settings', '/']) {
      __setPathname(path);
      const { toJSON, unmount } = render(<WebLandscapeGate />);
      expect(toJSON()).toBeNull();
      expect(screen.queryByText('Rotate your device')).toBeNull();
      unmount();
    }
  });

  it('hides itself in landscape web gameplay viewports', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    __setWindowDimensions({ width: 844, height: 390 });
    __setPathname('/play/board');

    const { toJSON } = render(<WebLandscapeGate />);
    expect(toJSON()).toBeNull();
  });
});
