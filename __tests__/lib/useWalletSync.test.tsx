import React from 'react';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import {
  __getConvexMocks,
  __setConvexAuthState,
  __setConvexMutation,
  __setConvexQueryResult,
  __resetConvexReactDouble,
} from '../doubles/convexReact';
import { __setClerkAuth, __resetClerkExpoDouble } from '../doubles/clerkExpo';
import { __setAuthDisabled, __resetAuthModeDouble } from '../doubles/authMode';
import {
  __setInstallationId,
  __resetDeviceInstallationDouble,
} from '../doubles/deviceInstallation';
import { useWalletSync } from '@/lib/hooks/useWalletSync';
import { usePlayStore } from '@/store/play';

function WalletSyncHarness() {
  useWalletSync();
  return <Text>ready</Text>;
}

type MutationArgs = Record<string, string | number | boolean | null>;

describe('useWalletSync', () => {
  const { useQueryMock, useMutationMock } = __getConvexMocks();
  let mutationCalls: MutationArgs[] = [];
  let mutationImpl: (args?: MutationArgs) => Promise<null> = async () => null;

  beforeEach(() => {
    __resetConvexReactDouble();
    __resetClerkExpoDouble();
    __resetAuthModeDouble();
    __resetDeviceInstallationDouble();
    mutationCalls = [];
    mutationImpl = async (args) => {
      if (args) mutationCalls.push(args);
      return null;
    };
    __setConvexMutation(async (args) => mutationImpl(args as MutationArgs | undefined));
    __setClerkAuth({ isLoaded: true, isSignedIn: false });
    __setConvexAuthState({ isAuthenticated: false, isLoading: false });
    __setAuthDisabled(false);
    __setConvexQueryResult(undefined);
    __setInstallationId('install_test');
    usePlayStore.setState({ session: null, tokens: 100, rapidFire: null });
  });

  it('sets the local token balance to 0 when the user is signed out', async () => {
    render(<WalletSyncHarness />);

    await waitFor(() => {
      expect(usePlayStore.getState().tokens).toBe(0);
    });
  });

  it('does not clear tokens when auth is disabled', async () => {
    __setAuthDisabled(true);
    usePlayStore.setState({ tokens: 42 });

    render(<WalletSyncHarness />);

    await waitFor(() => {
      expect(usePlayStore.getState().tokens).toBe(42);
    });
  });

  it('waits for the Convex user profile before setting up the wallet', async () => {
    __setClerkAuth({ isLoaded: true, isSignedIn: true });
    __setConvexAuthState({ isAuthenticated: true, isLoading: false });
    __setConvexQueryResult(undefined);

    const view = render(<WalletSyncHarness />);
    await waitFor(() => expect(useQueryMock).toHaveBeenCalled());
    expect(mutationCalls).toHaveLength(0);

    __setConvexQueryResult({ _id: 'user_123' });
    view.rerender(<WalletSyncHarness />);
    await waitFor(() => expect(mutationCalls.length).toBeGreaterThanOrEqual(2));
    expect(useMutationMock).toHaveBeenCalled();
  });

  it('does not grant starter balance after auth disappears during setup', async () => {
    let finishAccountSetup: (() => void) | undefined;
    let callCount = 0;
    mutationImpl = () =>
      new Promise((resolve) => {
        callCount += 1;
        if (callCount === 1) {
          finishAccountSetup = () => resolve(null);
          return;
        }
        resolve(null);
      });
    __setConvexMutation(async (args) => mutationImpl(args as MutationArgs | undefined));
    __setClerkAuth({ isLoaded: true, isSignedIn: true });
    __setConvexAuthState({ isAuthenticated: true, isLoading: false });
    __setConvexQueryResult({ _id: 'user_123' });

    const view = render(<WalletSyncHarness />);
    await waitFor(() => expect(callCount).toBe(1));

    __setClerkAuth({ isLoaded: true, isSignedIn: false });
    __setConvexAuthState({ isAuthenticated: false, isLoading: false });
    view.rerender(<WalletSyncHarness />);

    await act(async () => finishAccountSetup?.());
    expect(callCount).toBe(1);
  });
});
