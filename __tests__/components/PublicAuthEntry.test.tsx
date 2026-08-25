import React from 'react';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { PublicAuthEntry } from '@/components/PublicAuthEntry';
import { __setAuthDisabled, __resetAuthModeDouble } from '../doubles/authMode';
import { __setClerkAuth, __resetClerkExpoDouble } from '../doubles/clerkExpo';
import { router, __resetExpoRouterDouble } from '../doubles/expoRouter';
import { __setI18nMessages, __resetUseI18nDouble } from '../doubles/useI18n';

describe('PublicAuthEntry', () => {
  beforeEach(() => {
    __resetExpoRouterDouble();
    __resetClerkExpoDouble();
    __resetAuthModeDouble();
    __resetUseI18nDouble();
    __setI18nMessages({
      'auth.signUp.signIn': 'Sign in',
      'profile.guest.createAccount': 'CREATE ACCOUNT',
    });
    __setClerkAuth({ isLoaded: true, isSignedIn: false });
    __setAuthDisabled(false);
  });

  it('renders signed-out sign-in and create-account actions', () => {
    render(<PublicAuthEntry />);

    expect(screen.getByTestId('public-auth-entry-sign-in')).toHaveTextContent('Sign in');
    expect(screen.getByTestId('public-auth-entry-sign-up')).toHaveTextContent('CREATE ACCOUNT');
  });

  it('routes to existing auth screens', () => {
    render(<PublicAuthEntry />);

    fireEvent.press(screen.getByTestId('public-auth-entry-sign-in'));
    fireEvent.press(screen.getByTestId('public-auth-entry-sign-up'));

    expect(router.push).toHaveBeenNthCalledWith(1, '/(auth)/sign-in');
    expect(router.push).toHaveBeenNthCalledWith(2, '/(auth)/sign-up');
  });

  it('hides while auth is loading, signed in, or when auth bypass is enabled', () => {
    __setClerkAuth({ isLoaded: false, isSignedIn: false });
    const { rerender } = render(<PublicAuthEntry />);
    expect(screen.queryByTestId('public-auth-entry')).toBeNull();

    __setClerkAuth({ isLoaded: true, isSignedIn: true });
    rerender(<PublicAuthEntry />);
    expect(screen.queryByTestId('public-auth-entry')).toBeNull();

    __setClerkAuth({ isLoaded: true, isSignedIn: false });
    __setAuthDisabled(true);
    rerender(<PublicAuthEntry />);
    expect(screen.queryByTestId('public-auth-entry')).toBeNull();
  });
});
