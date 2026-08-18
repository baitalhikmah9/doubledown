import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockUseAuth = jest.fn(() => ({ isLoaded: true, isSignedIn: false }));
const mockUseConvexAuth = jest.fn(() => ({ isAuthenticated: false, isLoading: false }));
const mockIsAuthDisabled = jest.fn(() => false);
const mockUseQuery = jest.fn(() => undefined);
const mockMutation = jest.fn(async () => undefined);

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  const api = {
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    clear: jest.fn(async () => {
      store.clear();
    }),
  };
  return {
    __esModule: true,
    ...api,
    default: api,
  };
});

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('convex/react', () => ({
  useConvexAuth: () => mockUseConvexAuth(),
  useMutation: () => mockMutation,
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

jest.mock('@/lib/authMode', () => ({
  isAuthDisabled: () => mockIsAuthDisabled(),
}));

jest.mock('@/lib/deviceInstallation', () => ({
  getOrCreateInstallationId: jest.fn(async () => 'test-installation'),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

const { useWalletSync } = require('@/lib/hooks/useWalletSync') as typeof import('@/lib/hooks/useWalletSync');
const { usePlayStore } = require('@/store/play') as typeof import('@/store/play');

function WalletSyncHarness() {
  useWalletSync();
  return <Text>ready</Text>;
}

describe('useWalletSync', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseConvexAuth.mockReset();
    mockIsAuthDisabled.mockReset();
    mockUseQuery.mockReset();
    mockMutation.mockClear();

    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    mockIsAuthDisabled.mockReturnValue(false);
    mockUseQuery.mockReturnValue(undefined);

    usePlayStore.setState({ session: null, tokens: 100, rapidFire: null });
  });

  it('sets the local token balance to 0 when the user is signed out', async () => {
    render(<WalletSyncHarness />);

    await waitFor(() => {
      expect(usePlayStore.getState().tokens).toBe(0);
    });
  });

  it('does not clear tokens when auth is disabled', async () => {
    mockIsAuthDisabled.mockReturnValue(true);
    usePlayStore.setState({ tokens: 42 });

    render(<WalletSyncHarness />);

    await waitFor(() => {
      expect(usePlayStore.getState().tokens).toBe(42);
    });
  });

  it('waits for the Convex user profile before setting up the wallet', async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });

    const view = render(<WalletSyncHarness />);
    await waitFor(() => expect(mockUseQuery).toHaveBeenCalled());
    expect(mockMutation).not.toHaveBeenCalled();

    mockUseQuery.mockReturnValue({ _id: 'user_123' });
    view.rerender(<WalletSyncHarness />);
    await waitFor(() => expect(mockMutation).toHaveBeenCalledTimes(2));
  });

  it('does not grant starter balance after auth disappears during setup', async () => {
    let finishAccountSetup: (() => void) | undefined;
    mockMutation.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        finishAccountSetup = resolve;
      })
    );
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseQuery.mockReturnValue({ _id: 'user_123' });

    const view = render(<WalletSyncHarness />);
    await waitFor(() => expect(mockMutation).toHaveBeenCalledTimes(1));

    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    view.rerender(<WalletSyncHarness />);

    await act(async () => finishAccountSetup?.());
    expect(mockMutation).toHaveBeenCalledTimes(1);
  });
});
