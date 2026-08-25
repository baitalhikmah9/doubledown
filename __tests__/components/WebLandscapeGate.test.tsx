import React from 'react';
import { Platform } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { WebLandscapeGate, isMobileWebClient } from '@/components/WebLandscapeGate';
import { __setWindowDimensions } from '../doubles/windowDimensions';
import { __setPathname } from '../doubles/expoRouter';

type MediaQueryListStub = {
  matches: boolean;
  media: string;
  onchange: null;
  addListener: () => void;
  removeListener: () => void;
  addEventListener: () => void;
  removeEventListener: () => void;
  dispatchEvent: () => boolean;
};

function mediaStub(matches: boolean, media: string): MediaQueryListStub {
  return {
    matches,
    media,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };
}

/** Configure pointer/touch signals for mobile vs desktop web. */
function setWebInputProfile(profile: 'mobile' | 'desktop') {
  const mobile = profile === 'mobile';
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => {
      const q = query.replace(/\s+/g, ' ').trim();
      if (q.includes('pointer: coarse')) return mediaStub(mobile, query);
      if (q.includes('pointer: fine')) return mediaStub(!mobile, query);
      if (q.includes('hover: none')) return mediaStub(mobile, query);
      if (q.includes('hover: hover')) return mediaStub(!mobile, query);
      return mediaStub(false, query);
    },
  });
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    writable: true,
    value: mobile ? 5 : 0,
  });
}

describe('isMobileWebClient', () => {
  it('detects coarse-pointer mobile web', () => {
    setWebInputProfile('mobile');
    expect(isMobileWebClient()).toBe(true);
  });

  it('detects fine-pointer desktop web', () => {
    setWebInputProfile('desktop');
    expect(isMobileWebClient()).toBe(false);
  });
});

describe('WebLandscapeGate', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    setWebInputProfile('desktop');
  });

  it('is a no-op on native even in portrait', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    setWebInputProfile('mobile');
    __setWindowDimensions({ width: 390, height: 844 });
    __setPathname('/');

    const { toJSON } = render(<WebLandscapeGate />);
    expect(toJSON()).toBeNull();
  });

  it('blocks mobile web portrait on the home route', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    setWebInputProfile('mobile');
    __setWindowDimensions({ width: 390, height: 844 });
    __setPathname('/');

    const { toJSON } = render(<WebLandscapeGate />);
    expect(screen.getByText('Rotate your device')).toBeTruthy();
    expect(screen.getByText('Backfire plays in landscape only.')).toBeTruthy();
    // Walk the tree JSON for a11y props (parent links are unreliable across RNTL versions).
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('"accessibilityRole":"alert"');
    expect(tree).toContain('"accessibilityLiveRegion":"polite"');
  });

  it('blocks mobile web portrait on auth, admin, and legal routes', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    setWebInputProfile('mobile');
    __setWindowDimensions({ width: 390, height: 844 });

    for (const path of ['/login', '/admin', '/privacy', '/terms', '/delete-account', '/settings']) {
      __setPathname(path);
      const { unmount } = render(<WebLandscapeGate />);
      expect(screen.getByText('Rotate your device')).toBeTruthy();
      unmount();
    }
  });

  it('allows mobile web landscape', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    setWebInputProfile('mobile');
    __setWindowDimensions({ width: 844, height: 390 });
    __setPathname('/');

    const { toJSON } = render(<WebLandscapeGate />);
    expect(toJSON()).toBeNull();
    expect(screen.queryByText('Rotate your device')).toBeNull();
  });

  it('allows desktop web portrait (narrow window)', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    setWebInputProfile('desktop');
    __setWindowDimensions({ width: 800, height: 1200 });
    __setPathname('/');

    const { toJSON } = render(<WebLandscapeGate />);
    expect(toJSON()).toBeNull();
    expect(screen.queryByText('Rotate your device')).toBeNull();
  });

  it('blocks mobile web portrait play routes', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    setWebInputProfile('mobile');
    __setWindowDimensions({ width: 390, height: 844 });
    __setPathname('/play/board');

    render(<WebLandscapeGate />);
    expect(screen.getByText('Rotate your device')).toBeTruthy();
  });
});
