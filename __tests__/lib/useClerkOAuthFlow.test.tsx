import React from 'react';
import { afterAll, describe, expect, it, jest } from '@jest/globals';
import { Platform, Text } from 'react-native';
import { render } from '@testing-library/react-native';

// Mock @clerk/clerk-expo hooks before importing the module under test.
const mockAuthenticateWithRedirect = jest.fn<(params: { strategy: string; redirectUrl: string; redirectUrlComplete: string }) => Promise<void>>().mockResolvedValue(undefined);
const mockStartSSOFlow = jest.fn<(params: { strategy: string; redirectUrl: string }) => Promise<{ createdSessionId: string | null; setActive?: unknown; authSessionResult: unknown }>>().mockResolvedValue({
  createdSessionId: null,
  setActive: undefined,
  authSessionResult: null,
});
const mockStartAppleAuthenticationFlow = jest.fn();

jest.mock('@clerk/clerk-expo', () => ({
  useSignIn: () => ({
    signIn: { authenticateWithRedirect: mockAuthenticateWithRedirect },
    isLoaded: true,
  }),
  useSSO: () => ({ startSSOFlow: mockStartSSOFlow }),
  useSignInWithApple: () => ({
    startAppleAuthenticationFlow: mockStartAppleAuthenticationFlow,
  }),
}));

jest.mock('@/store/themedAlert', () => ({
  showThemedAlert: jest.fn(),
}));

jest.mock('@/lib/auth/appleSignIn', () => ({
  prefersNativeAppleSignIn: () => false,
  supportsAppleSignIn: () => true,
}));

jest.mock('@/lib/auth/clerkOAuthRedirect', () => ({
  clerkOAuthRedirectUrl: (path: string) => `https://example.test${path}`,
}));

import { useClerkOAuthFlow } from '@/lib/hooks/useClerkOAuthFlow';

// Wrapper component that exposes the hook's signInWithOAuthStrategy via a callback.
function Harness({ onReady }: { onReady: (fn: (s: string) => Promise<void>) => void }) {
  const { signInWithOAuthStrategy } = useClerkOAuthFlow('/(app)/');
  onReady(signInWithOAuthStrategy as (s: string) => Promise<void>);
  return <Text>test</Text>;
}

describe('useClerkOAuthFlow web redirect', () => {
  const originalPlatform = Platform.OS;

  afterAll(() => {
    (Platform as { OS: string }).OS = originalPlatform;
  });

  it('uses authenticateWithRedirect (not startSSOFlow) on web for Google', async () => {
    (Platform as { OS: string }).OS = 'web';
    mockAuthenticateWithRedirect.mockClear();
    mockStartSSOFlow.mockClear();

    let strategy: ((s: string) => Promise<void>) | null = null;
    render(<Harness onReady={(fn) => { strategy = fn; }} />);

    await strategy!('oauth_google');

    expect(mockAuthenticateWithRedirect).toHaveBeenCalledTimes(1);
    expect(mockAuthenticateWithRedirect).toHaveBeenCalledWith({
      strategy: 'oauth_google',
      redirectUrl: 'https://example.test/(app)/',
      redirectUrlComplete: 'https://example.test/(app)/',
    });
    // startSSOFlow (popup-based) must NOT be called on web.
    expect(mockStartSSOFlow).not.toHaveBeenCalled();
  });

  it('uses startSSOFlow (not authenticateWithRedirect) on native for Google', async () => {
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
