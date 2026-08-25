import React from 'react';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useConvexUserProfileSync } from '@/lib/hooks/useConvexUserProfileSync';
import {
  __setConvexAuthState,
  __setConvexMutation,
  __resetConvexReactDouble,
} from '../doubles/convexReact';
import {
  __setClerkUser,
  __setClerkUserLoaded,
  __resetClerkExpoDouble,
} from '../doubles/clerkExpo';

function ProfileSyncHarness() {
  useConvexUserProfileSync();
  return <Text>ready</Text>;
}

describe('useConvexUserProfileSync', () => {
  const mutationCalls: Record<string, string | undefined>[] = [];

  beforeEach(() => {
    __resetConvexReactDouble();
    __resetClerkExpoDouble();
    mutationCalls.length = 0;
    __setConvexMutation(async (args) => {
      // SAFETY: mutation args are email/name records in this hook path.
      mutationCalls.push(args as Record<string, string | undefined>);
      return 'user_123';
    });
    __setConvexAuthState({ isAuthenticated: true, isLoading: false });
  });

  it('upserts the Convex user from the loaded Clerk user', async () => {
    __setClerkUser({
      id: 'clerk_user_123',
      primaryEmailAddress: { emailAddress: 'admin@example.com' },
      fullName: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
    });

    render(<ProfileSyncHarness />);

    await waitFor(() => {
      expect(mutationCalls).toContainEqual({
        email: 'admin@example.com',
        name: 'Admin User',
      });
    });
  });

  it('does not upsert before Clerk user state loads', () => {
    __setClerkUserLoaded(false);
    __setClerkUser(null);
    render(<ProfileSyncHarness />);
    expect(mutationCalls).toHaveLength(0);
  });

  it('waits for Convex auth before upserting', () => {
    __setConvexAuthState({ isAuthenticated: false, isLoading: true });
    __setClerkUser({
      id: 'clerk_user_123',
      primaryEmailAddress: { emailAddress: 'admin@example.com' },
      fullName: 'Admin User',
    });

    render(<ProfileSyncHarness />);
    expect(mutationCalls).toHaveLength(0);
  });
});
