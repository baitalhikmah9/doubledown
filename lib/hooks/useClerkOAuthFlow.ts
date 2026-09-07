import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useClerk, useSignIn, useSSO, useSignInWithApple } from '@clerk/clerk-expo';
import type { OAuthStrategy } from '@clerk/types';
import { prefersNativeAppleSignIn, supportsAppleSignIn } from '@/lib/auth/appleSignIn';
import {
  clerkNativeSsoCallbackRedirectUrls,
  clerkOAuthRedirectUrl,
} from '@/lib/auth/clerkOAuthRedirect';
import { showThemedAlert } from '@/store/themedAlert';

/** Clerk stores the client JWT under this SecureStore key (see @clerk/clerk-expo createClerkInstance). */
const CLERK_CLIENT_JWT_KEY = '__clerk_client_jwt';

const MISSING_EXTERNAL_REDIRECT =
  'Missing external verification redirect URL for SSO flow';

/** True when the user dismissed native/Apple auth (Error or structured Clerk/native errors). */
export function isAppleCancelError(error: unknown): boolean {
  if (error == null) return false;

  let code = '';
  let message = '';

  if (typeof error === 'string') {
    message = error;
  } else if (typeof error === 'object') {
    if ('code' in error && error.code != null) {
      code = String(error.code);
    }
    if (error instanceof Error) {
      message = error.message;
    } else if ('message' in error && error.message != null) {
      message = String(error.message);
    }
  }

  return (
    code === 'ERR_REQUEST_CANCELED' ||
    code === 'ERR_CANCELED' ||
    message.includes('ERR_REQUEST_CANCELED') ||
    message.includes('ERR_CANCELED')
  );
}

function isMissingExternalRedirectError(error: unknown): boolean {
  if (error == null) return false;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && 'message' in error && error.message != null
        ? String(error.message)
        : String(error);
  return message.includes(MISSING_EXTERNAL_REDIRECT);
}

function isSessionExistsError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false;
  const message =
    error instanceof Error
      ? error.message
      : 'message' in error && error.message != null
        ? String(error.message)
        : '';
  if (message.toLowerCase().includes('already signed in') || message.includes('session_exists')) {
    return true;
  }
  if ('errors' in error && Array.isArray((error as { errors: unknown }).errors)) {
    return (error as { errors: Array<{ code?: string; message?: string }> }).errors.some(
      (e) =>
        e.code === 'session_exists' ||
        (e.message?.toLowerCase().includes('already signed in') ?? false)
    );
  }
  return false;
}

function isRetryableSsoError(error: unknown): boolean {
  return isMissingExternalRedirectError(error) || isSessionExistsError(error);
}

async function clearStaleClerkClientJwt(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CLERK_CLIENT_JWT_KEY);
  } catch {
    // Best-effort; SSO retry still proceeds.
  }
}

function isDummyClerkClient(client: { id?: string | null } | null | undefined): boolean {
  const id = client?.id ?? '';
  return id === '' || id.startsWith('client_DUMMY') || id === 'client_init';
}

/**
 * Clerk Expo can mark isLoaded=true while still serving a offline/dummy client
 * (`client_DUMMY_ID`). OAuth create then leaves firstFactorVerification empty
 * (status=none) and throws MISSING_EXTERNAL_REDIRECT. Wait for a real FAPI client.
 */
async function waitForLiveClerkClient(
  getClient: () => { id?: string | null } | null | undefined,
  reload: (() => Promise<void>) | undefined,
  timeoutMs = 8000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let attemptedReload = false;

  while (Date.now() < deadline) {
    const client = getClient();
    if (client && !isDummyClerkClient(client)) return;

    if (!attemptedReload && reload) {
      attemptedReload = true;
      try {
        await reload();
      } catch {
        // Keep polling; network may still be coming up.
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    'Sign-in is still connecting to Clerk. Check network and try again in a moment.'
  );
}

/**
 * Google / Apple auth via Clerk.
 * - Google: browser SSO on native via Clerk `useSSO` (known-good path from 622729c)
 * - Apple iOS: native Sign in with Apple (`useSignInWithApple`)
 * - Apple web: full-page redirect SSO (`oauth_apple`)
 * - Apple Android: not available (UI hidden; guard remains)
 *
 * On web, `useSSO.startSSOFlow` uses `expo-web-browser.openAuthSessionAsync`,
 * which opens a popup that browsers block. The web branch instead calls
 * `signIn.authenticateWithRedirect()` for a full-page redirect to the OAuth
 * provider; the return is handled by `app/sso-callback.tsx`.
 *
 * Native keeps `startSSOFlow` as the primary implementation. Around it we:
 * 1. Wait for a live (non-dummy) Clerk client before starting OAuth
 * 2. On missing-redirect / session_exists, clear stale JWT and retry each allowlisted redirect once
 */
export function useClerkOAuthFlow(redirectPath = '/(app)/') {
  const { startSSOFlow } = useSSO();
  const clerk = useClerk();
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);

  const signInWithOAuthStrategy = useCallback(
    async (strategy: OAuthStrategy) => {
      if (inFlight.current) return;

      if (strategy === 'oauth_apple' && !supportsAppleSignIn()) {
        showThemedAlert(
          'Unavailable',
          'Sign in with Apple is not available on this device. Use Google or email instead.',
        );
        return;
      }

      inFlight.current = true;
      setBusy(true);
      try {
        if (strategy === 'oauth_apple' && prefersNativeAppleSignIn()) {
          const { createdSessionId, setActive } = await startAppleAuthenticationFlow();
          if (createdSessionId && setActive) {
            await setActive({ session: createdSessionId });
          }
          return;
        }

        // Web: full-page redirect via signIn.authenticateWithRedirect(). This
        // avoids expo-web-browser's popup (blocked by browsers). The browser
        // navigates to the OAuth provider and returns to redirectUrl (the
        // /sso-callback route), where AuthenticateWithRedirectCallback completes
        // the flow and navigates to redirectUrlComplete (the app destination).
        if (Platform.OS === 'web') {
          if (!isSignInLoaded || !signIn) {
            throw new Error('Sign-in is still loading. Please try again.');
          }
          const redirectUrl = clerkOAuthRedirectUrl('/sso-callback');
          const redirectUrlComplete = clerkOAuthRedirectUrl(redirectPath);
          await signIn.authenticateWithRedirect({
            strategy,
            redirectUrl,
            redirectUrlComplete,
          });
          // authenticateWithRedirect navigates away; the code below runs only
          // if the redirect didn't happen (e.g. misconfigured redirect URL).
          return;
        }

        if (!isSignInLoaded) {
          throw new Error('Sign-in is still loading. Please try again.');
        }

        const reload =
          typeof (clerk as { __internal_reloadInitialResources?: () => Promise<void> })
            .__internal_reloadInitialResources === 'function'
            ? () =>
                (
                  clerk as { __internal_reloadInitialResources: () => Promise<void> }
                ).__internal_reloadInitialResources()
            : undefined;

        await waitForLiveClerkClient(() => clerk.client ?? null, reload);

        const redirectUrls = clerkNativeSsoCallbackRedirectUrls();
        let lastError: unknown = null;

        for (const redirectUrl of redirectUrls) {
          try {
            const { createdSessionId, setActive } = await startSSOFlow({
              strategy,
              redirectUrl,
            });
            if (createdSessionId && setActive) {
              await setActive({ session: createdSessionId });
            }
            return;
          } catch (error) {
            lastError = error;
            if (!isRetryableSsoError(error)) throw error;

            await clearStaleClerkClientJwt();
            if (reload) {
              try {
                await reload();
              } catch {
                // Continue trying remaining redirect URLs.
              }
            }
          }
        }

        if (lastError) throw lastError;
        throw new Error(MISSING_EXTERNAL_REDIRECT);
      } catch (e) {
        if (strategy === 'oauth_apple' && isAppleCancelError(e)) {
          return;
        }
        console.error('[Clerk SSO]', e);
        const message =
          e instanceof Error
            ? isMissingExternalRedirectError(e)
              ? 'Google sign-in could not start. Wait a moment for the app to finish connecting, check network, then try again. If it keeps failing, Clerk Native applications must list package com.playbackfire.app with mobile SSO redirects allowlisted.'
              : e.message
            : 'Something went wrong. Please try again.';
        showThemedAlert('Sign-in failed', message);
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [
      redirectPath,
      isSignInLoaded,
      signIn,
      clerk,
      startAppleAuthenticationFlow,
      startSSOFlow,
    ]
  );

  return { busy, signInWithOAuthStrategy };
}
