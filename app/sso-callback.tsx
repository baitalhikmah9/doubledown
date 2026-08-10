import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';

/** Required at module scope so `openAuthSessionAsync` can complete when OAuth returns here. */
WebBrowser.maybeCompleteAuthSession();

/**
 * OAuth return target.
 *
 * Native: `startSSOFlow` returns here via `openAuthSessionAsync`; the redirect
 * to the app shell happens via the `<Redirect>` below.
 *
 * Web: `signIn.authenticateWithRedirect()` sends the browser to the OAuth
 * provider, which returns here with a `rotating_token_nonce` query param.
 * `<AuthenticateWithRedirectCallback>` calls `Clerk.handleRedirectCallback()`
 * to complete the sign-in and navigate to `redirectUrlComplete`.
 */
export default function SsoCallbackScreen() {
  if (Platform.OS === 'web') {
    return <AuthenticateWithRedirectCallback />;
  }
  return <Redirect href="/(app)/" />;
}
