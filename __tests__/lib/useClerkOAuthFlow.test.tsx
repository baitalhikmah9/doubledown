import React from 'react';
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { Platform, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import {
  __getClerkAuthenticateWithRedirect,
  __getClerkStartSSOFlow,
  __resetClerkExpoDouble,
} from '../doubles/clerkExpo';
import { useClerkOAuthFlow, isAppleCancelError } from '@/lib/hooks/useClerkOAuthFlow';


function Harness({ onReady }: { onReady: (fn: (s: string) => Promise<void>) => void }) {
  const { signInWithOAuthStrategy } = useClerkOAuthFlow('/(app)/');
  // SAFETY: Controlled test fixture boundary cast.
  onReady(signInWithOAuthStrategy as (s: string) => Promise<void>);
  return <Text>test</Text>;
}

describe('useClerkOAuthFlow web redirect', () => {
  const originalPlatform = Platform.OS;
  const mockAuthenticateWithRedirect = __getClerkAuthenticateWithRedirect();
  const mockStartSSOFlow = __getClerkStartSSOFlow();

  beforeEach(() => {
    __resetClerkExpoDouble();
  });

  afterAll(() => {
    // SAFETY: Controlled test fixture boundary cast.
    (Platform as { OS: string }).OS = originalPlatform;
  });

  it('uses authenticateWithRedirect (not startSSOFlow) on web for Google', async () => {
    // SAFETY: Controlled test fixture boundary cast.
    (Platform as { OS: string }).OS = 'web';
    // SAFETY: jsdom-less RN test host needs a location origin for web redirects.
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { origin: 'https://example.test', href: 'https://example.test/' },
    });
    mockAuthenticateWithRedirect.mockClear();
    mockStartSSOFlow.mockClear();

    let strategy: ((s: string) => Promise<void>) | null = null;
    render(<Harness onReady={(fn) => { strategy = fn; }} />);

    await strategy!('oauth_google');

    expect(mockAuthenticateWithRedirect).toHaveBeenCalledTimes(1);
    expect(mockAuthenticateWithRedirect).toHaveBeenCalledWith({
      strategy: 'oauth_google',
      redirectUrl: 'https://example.test/sso-callback',
      redirectUrlComplete: 'https://example.test',
    });
    // startSSOFlow (popup-based) must NOT be called on web.
    expect(mockStartSSOFlow).not.toHaveBeenCalled();
  });

  it('uses startSSOFlow (not authenticateWithRedirect) on native for Google', async () => {
    // SAFETY: Controlled test fixture boundary cast.
    (Platform as { OS: string }).OS = 'ios';
    mockAuthenticateWithRedirect.mockClear();
    mockStartSSOFlow.mockClear();

    let strategy: ((s: string) => Promise<void>) | null = null;
    render(<Harness onReady={(fn) => { strategy = fn; }} />);

    await strategy!('oauth_google');

    expect(mockStartSSOFlow).toHaveBeenCalledTimes(1);
    expect(mockAuthenticateWithRedirect).not.toHaveBeenCalled();
  });
});

describe('isAppleCancelError', () => {
  it('detects ERR_REQUEST_CANCELED on Error.message', () => {
    expect(isAppleCancelError(new Error('The operation was cancelled: ERR_REQUEST_CANCELED'))).toBe(
      true
    );
  });

  it('detects ERR_REQUEST_CANCELED on structured code field', () => {
    expect(isAppleCancelError({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
    expect(isAppleCancelError({ code: 'ERR_CANCELED', message: 'user closed sheet' })).toBe(true);
  });

  it('detects Error instances that also carry a code property', () => {
    const err = new Error('Sign in cancelled');
    // SAFETY: native Apple auth errors attach a string code.
    (err as Error & { code: string }).code = 'ERR_REQUEST_CANCELED';
    expect(isAppleCancelError(err)).toBe(true);
  });

  it('returns false for unrelated failures', () => {
    expect(isAppleCancelError(new Error('network down'))).toBe(false);
    expect(isAppleCancelError({ code: 'other' })).toBe(false);
    expect(isAppleCancelError(null)).toBe(false);
    expect(isAppleCancelError(undefined)).toBe(false);
  });
});
