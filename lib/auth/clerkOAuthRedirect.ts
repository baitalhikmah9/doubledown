import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';

/** Expo Router screen for Clerk native OAuth return (`app/sso-callback.tsx`). */
export const CLERK_SSO_CALLBACK_PATH = 'sso-callback';

const FALLBACK_ANDROID_PACKAGE = 'com.playbackfire.app';
const FALLBACK_IOS_BUNDLE_IDENTIFIER = 'com.playbackfire.app';

/** Clerk Native Applications auto-provisions `clerk://<package>.callback` for registered apps. */
function clerkRegisteredNativeCallbackUrl(): string | null {
  const androidPackage = Constants.expoConfig?.android?.package ?? FALLBACK_ANDROID_PACKAGE;
  if (Platform.OS === 'android' && androidPackage) {
    return `clerk://${androidPackage}.callback`;
  }
  const iosBundle = Constants.expoConfig?.ios?.bundleIdentifier ?? FALLBACK_IOS_BUNDLE_IDENTIFIER;
  if (Platform.OS === 'ios' && iosBundle) {
    return `clerk://${iosBundle}.callback`;
  }
  return null;
}

function authSessionSsoCallbackRedirectUrl(): string {
  return AuthSession.makeRedirectUri({
    path: CLERK_SSO_CALLBACK_PATH,
    isTripleSlashed: true,
  });
}

/**
 * Canonical native OAuth return URL for `useSSO` / openAuthSessionAsync.
 * Prefer Clerk's auto-provisioned `clerk://…callback` outside Expo Go (see
 * commit 622729c / cd0a218). Expo Go must use `exp://…/sso-callback`.
 */
export function clerkNativeSsoCallbackRedirectUrl(): string {
  if (isRunningInExpoGo()) {
    return authSessionSsoCallbackRedirectUrl();
  }

  const registered = clerkRegisteredNativeCallbackUrl();
  if (registered) return registered;
  return authSessionSsoCallbackRedirectUrl();
}

/**
 * Ordered native redirect candidates for recovery retries only.
 * Primary path uses `clerkNativeSsoCallbackRedirectUrl()` alone (known-good).
 * Fallbacks cover production allowlist drift without replacing the primary flow.
 */
export function clerkNativeSsoCallbackRedirectUrls(): string[] {
  if (isRunningInExpoGo()) {
    return [authSessionSsoCallbackRedirectUrl()];
  }

  const urls: string[] = [];
  const primary = clerkNativeSsoCallbackRedirectUrl();
  urls.push(primary);

  const appScheme = authSessionSsoCallbackRedirectUrl();
  if (!urls.includes(appScheme)) urls.push(appScheme);

  const androidPackage = Constants.expoConfig?.android?.package ?? FALLBACK_ANDROID_PACKAGE;
  const iosBundle = Constants.expoConfig?.ios?.bundleIdentifier ?? FALLBACK_IOS_BUNDLE_IDENTIFIER;
  const packageCallback =
    Platform.OS === 'ios' ? `${iosBundle}://callback` : `${androidPackage}://callback`;
  if (!urls.includes(packageCallback)) urls.push(packageCallback);

  return urls;
}

/**
 * Clerk `redirectUrl` after OAuth.
 * Native (standalone / dev client): `clerk://<package>.callback` when registered.
 * Native (Expo Go): `AuthSession.makeRedirectUri` → `exp://…/sso-callback`.
 * `app/+native-intent.tsx` rewrites callback deep links to `/sso-callback` for Expo Router.
 * Web: same-origin path (route groups like `/(app)` break popup handshake).
 */
export function clerkOAuthRedirectUrl(redirectPath: string): string {
  if (Platform.OS !== 'web' || !globalThis.location) {
    return clerkNativeSsoCallbackRedirectUrl();
  }
  const isDefaultAppShell =
    redirectPath === '/(app)/' || redirectPath === '/(app)' || redirectPath === '/';
  const path = isDefaultAppShell ? '/' : redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;
  const href = new URL(path, globalThis.location.origin).href;
  return href.replace(/\/$/, '');
}

function isOAuthCallbackPath(path: string): boolean {
  const lower = path.toLowerCase();
  if (lower.includes('sso-callback') || lower.includes('oauth-callback')) {
    return true;
  }

  try {
    const url = new URL(path, `${Linking.createURL('')}/`);
    const host = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();
    if (host.endsWith('.callback') || host.includes('playbackfire.app')) {
      return true;
    }
    // `{package}://callback` production default from Clerk native docs
    if (pathname === '/callback' || pathname === 'callback' || host === 'callback') {
      return true;
    }
    return false;
  } catch {
    return lower.includes('callback');
  }
}

/** Rewrite third-party OAuth callback URLs to the Expo Router screen. */
export function rewriteNativeOAuthCallbackPath(path: string, initial: boolean): string {
  // OAuth returns while Chrome is foregrounded use `initial: false` - still rewrite.
  if (isOAuthCallbackPath(path)) {
    return `/${CLERK_SSO_CALLBACK_PATH}`;
  }

  if (!initial) return path;
  return path;
}
