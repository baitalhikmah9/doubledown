import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import { __setIsRunningInExpoGo, __resetExpoModuleDouble } from '../doubles/expoModule';
import { __setExpoConstants, __resetExpoConstantsDouble } from '../doubles/expoConstants';
import { __resetExpoAuthSessionDouble } from '../doubles/expoAuthSession';
import {
  clerkNativeSsoCallbackRedirectUrl,
  clerkNativeSsoCallbackRedirectUrls,
  clerkOAuthRedirectUrl,
  rewriteNativeOAuthCallbackPath,
} from '@/lib/auth/clerkOAuthRedirect';

describe('rewriteNativeOAuthCallbackPath', () => {
  it('rewrites Clerk Android callback host to sso-callback route on cold start', () => {
    expect(
      rewriteNativeOAuthCallbackPath(
        'clerk://com.playbackfire.app.callback?rotating_token_nonce=abc',
        true
      )
    ).toBe('/sso-callback');
  });

  it('rewrites package://callback production default to sso-callback', () => {
    expect(
      rewriteNativeOAuthCallbackPath(
        'com.playbackfire.app://callback?rotating_token_nonce=abc',
        false
      )
    ).toBe('/sso-callback');
  });

  it('rewrites Clerk callback when app is already open (OAuth return)', () => {
    expect(
      rewriteNativeOAuthCallbackPath(
        'clerk://com.playbackfire.app.callback?rotating_token_nonce=abc',
        false
      )
    ).toBe('/sso-callback');
  });

  it('rewrites backfire sso-callback deep links on cold start', () => {
    expect(
      rewriteNativeOAuthCallbackPath(
        'backfire:///sso-callback?rotating_token_nonce=abc',
        true
      )
    ).toBe('/sso-callback');
    expect(
      rewriteNativeOAuthCallbackPath(
        'backfire://sso-callback?rotating_token_nonce=abc',
        true
      )
    ).toBe('/sso-callback');
  });

  it('rewrites Expo Go exp:// sso-callback deep links', () => {
    expect(
      rewriteNativeOAuthCallbackPath(
        'exp://192.168.1.10:8081/--/sso-callback?rotating_token_nonce=abc',
        false
      )
    ).toBe('/sso-callback');
  });

  it('leaves unrelated paths unchanged when app is already open', () => {
    expect(rewriteNativeOAuthCallbackPath('/(app)/', false)).toBe('/(app)/');
  });
});

describe('clerkNativeSsoCallbackRedirectUrl', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    __resetExpoModuleDouble();
    __resetExpoConstantsDouble();
    __resetExpoAuthSessionDouble();
  });

  afterEach(() => {
    __setIsRunningInExpoGo(false);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    __setExpoConstants({
      expoConfig: {
        extra: {},
        scheme: 'backfire',
        android: { package: 'com.playbackfire.app' },
        ios: { bundleIdentifier: 'com.playbackfire.app' },
      },
    });
  });

  it('uses AuthSession makeRedirectUri in Expo Go (not clerk:// package callback)', () => {
    __setIsRunningInExpoGo(true);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

    expect(clerkNativeSsoCallbackRedirectUrl()).toBe(
      'exp://192.168.1.10:8081/--/sso-callback'
    );
    expect(makeRedirectUri).toHaveBeenCalledWith({
      path: 'sso-callback',
      isTripleSlashed: true,
    });
  });

  it('uses clerk:// package callback outside Expo Go on iOS', () => {
    __setIsRunningInExpoGo(false);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

    expect(clerkNativeSsoCallbackRedirectUrl()).toBe(
      'clerk://com.playbackfire.app.callback'
    );
  });

  it('uses clerk:// package callback outside Expo Go on Android', () => {
    __setIsRunningInExpoGo(false);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    expect(clerkNativeSsoCallbackRedirectUrl()).toBe(
      'clerk://com.playbackfire.app.callback'
    );
  });

  it('lists clerk://, app scheme, and package://callback candidates on Android', () => {
    __setIsRunningInExpoGo(false);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    const urls = clerkNativeSsoCallbackRedirectUrls();
    expect(urls[0]).toBe('clerk://com.playbackfire.app.callback');
    expect(urls).toContain('exp://192.168.1.10:8081/--/sso-callback');
    expect(urls).toContain('com.playbackfire.app://callback');
  });

  it('falls back to the hardcoded package when expoConfig is missing on Android', () => {
    __setIsRunningInExpoGo(false);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    Object.defineProperty(Constants, 'expoConfig', { configurable: true, value: null });

    expect(clerkNativeSsoCallbackRedirectUrl()).toBe(
      'clerk://com.playbackfire.app.callback'
    );
  });
});

describe('clerkOAuthRedirectUrl', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    __resetExpoModuleDouble();
    __resetExpoAuthSessionDouble();
  });

  afterEach(() => {
    __setIsRunningInExpoGo(false);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  });

  it('returns Expo Go redirect on native when running in Expo Go', () => {
    __setIsRunningInExpoGo(true);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

    expect(clerkOAuthRedirectUrl('/(app)/')).toBe(
      'exp://192.168.1.10:8081/--/sso-callback'
    );
  });
});
