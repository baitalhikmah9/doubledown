import React from 'react';
import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Platform, Text } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { deleteItemAsync } from 'expo-secure-store';
import {
  __getClerkAuthenticateWithRedirect,
  __getClerkReloadInitialResources,
  __getClerkStartSSOFlow,
  __resetClerkExpoDouble,
  __setClerkClient,
} from '../doubles/clerkExpo';
import { __resetExpoWebBrowserDouble } from '../doubles/expoWebBrowser';
import { useClerkOAuthFlow, isAppleCancelError } from '@/lib/hooks/useClerkOAuthFlow';

function Harness({ onReady }: { onReady: (fn: (s: string) => Promise<void>) => void }) {
  const { signInWithOAuthStrategy } = useClerkOAuthFlow('/(app)/');
  // SAFETY: Controlled test fixture boundary cast.
  onReady(signInWithOAuthStrategy as (s: string) => Promise<void>);
  return <Text>test</Text>;
}

describe('useClerkOAuthFlow', () => {
  const originalPlatform = Platform.OS;
  const mockAuthenticateWithRedirect = __getClerkAuthenticateWithRedirect();
  const mockStartSSOFlow = __getClerkStartSSOFlow();
  const mockReload = __getClerkReloadInitialResources();

  beforeEach(() => {
    __resetClerkExpoDouble();
    __resetExpoWebBrowserDouble();
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

    await act(async () => {
      await strategy!('oauth_google');
    });

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

    await act(async () => {
      await strategy!('oauth_google');
    });

    expect(mockStartSSOFlow).toHaveBeenCalledTimes(1);
    expect(mockStartSSOFlow.mock.calls[0]?.[0]).toMatchObject({
      strategy: 'oauth_google',
    });
    expect(typeof mockStartSSOFlow.mock.calls[0]?.[0]?.redirectUrl).toBe('string');
    expect(mockAuthenticateWithRedirect).not.toHaveBeenCalled();
  });

  it('retries startSSOFlow after missing-redirect by clearing stale client JWT', async () => {
    // SAFETY: Controlled test fixture boundary cast.
    (Platform as { OS: string }).OS = 'android';
    mockStartSSOFlow.mockReset();
    mockStartSSOFlow
      .mockRejectedValueOnce(new Error('Missing external verification redirect URL for SSO flow'))
      .mockResolvedValue({
        createdSessionId: 'sess_retry',
        setActive: jest.fn(async () => undefined),
        authSessionResult: null,
      });
    mockReload.mockClear();
    (deleteItemAsync as jest.Mock).mockClear();

    let strategy: ((s: string) => Promise<void>) | null = null;
    render(<Harness onReady={(fn) => { strategy = fn; }} />);

    await act(async () => {
      await strategy!('oauth_google');
    });

    expect(mockStartSSOFlow.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(deleteItemAsync).toHaveBeenCalledWith('__clerk_client_jwt');
    expect(mockReload).toHaveBeenCalled();
  });

  it('refuses OAuth while Clerk is still on a dummy offline client, then proceeds after reload', async () => {
    // SAFETY: Controlled test fixture boundary cast.
    (Platform as { OS: string }).OS = 'android';
    __setClerkClient({ id: 'client_DUMMY_ID' });
    mockStartSSOFlow.mockClear();
    mockReload.mockImplementation(async () => {
      __setClerkClient({ id: 'client_live_after_reload' });
    });

    let strategy: ((s: string) => Promise<void>) | null = null;
    render(<Harness onReady={(fn) => { strategy = fn; }} />);

    await act(async () => {
      await strategy!('oauth_google');
    });

    expect(mockReload).toHaveBeenCalled();
    expect(mockStartSSOFlow).toHaveBeenCalled();
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
