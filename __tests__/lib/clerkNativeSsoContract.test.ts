/**
 * Static contract for native Clerk SSO.
 * Fails CI / prod builds if the Android OAuth redirect path is gutted again.
 * Runtime recovery alone is not enough; this locks the wiring that must ship.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const root = path.resolve(__dirname, '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('Clerk native SSO contract (prod regression lock)', () => {
  it('keeps Android intent filters for clerk:// and package://callback', () => {
    const app = JSON.parse(read('app.json')) as {
      expo: {
        android: {
          package: string;
          intentFilters: Array<{ data?: Array<{ scheme?: string; host?: string }> }>;
        };
      };
    };

    expect(app.expo.android.package).toBe('com.playbackfire.app');

    const pairs = app.expo.android.intentFilters.flatMap((filter) =>
      (filter.data ?? []).map((d) => `${d.scheme ?? ''}://${d.host ?? ''}`)
    );

    expect(pairs).toContain('clerk://com.playbackfire.app.callback');
    expect(pairs).toContain('com.playbackfire.app://callback');
  });

  it('keeps native SSO redirect helpers with multi-candidate recovery', () => {
    const src = read('lib/auth/clerkOAuthRedirect.ts');
    expect(src).toContain('clerkNativeSsoCallbackRedirectUrl');
    expect(src).toContain('clerkNativeSsoCallbackRedirectUrls');
    expect(src).toContain('clerk://${androidPackage}.callback');
    expect(src).toContain('://callback');
    expect(src).toContain('rewriteNativeOAuthCallbackPath');
    expect(src).toContain("CLERK_SSO_CALLBACK_PATH = 'sso-callback'");
  });

  it('keeps hardened useSSO path: live client wait, JWT clear, multi-redirect retry', () => {
    const src = read('lib/hooks/useClerkOAuthFlow.ts');
    expect(src).toContain('useSSO');
    expect(src).toContain('startSSOFlow');
    expect(src).toContain('waitForLiveClerkClient');
    expect(src).toContain('client_DUMMY');
    expect(src).toContain("__clerk_client_jwt");
    expect(src).toContain('deleteItemAsync');
    expect(src).toContain('clerkNativeSsoCallbackRedirectUrls');
    expect(src).toContain('Missing external verification redirect URL for SSO flow');
    expect(src).toContain('__internal_reloadInitialResources');
    // Must not drop back to bare startSSOFlow-only without recovery.
    expect(src).toMatch(/for\s*\(\s*const\s+redirectUrl\s+of\s+redirectUrls\s*\)/);
  });

  it('keeps Expo Router OAuth return wiring', () => {
    const nativeIntent = read('app/+native-intent.tsx');
    expect(nativeIntent).toContain('rewriteNativeOAuthCallbackPath');

    const callback = read('app/sso-callback.tsx');
    expect(callback).toContain('maybeCompleteAuthSession');
    expect(callback).toContain('AuthenticateWithRedirectCallback');
  });

  it('keeps regression tests for the failure modes that already shipped broken', () => {
    const flowTest = read('__tests__/lib/useClerkOAuthFlow.test.tsx');
    expect(flowTest).toContain('missing-redirect');
    expect(flowTest).toContain('dummy offline client');
    expect(flowTest).toContain('__clerk_client_jwt');

    const redirectTest = read('__tests__/lib/clerkOAuthRedirect.test.ts');
    expect(redirectTest).toContain('package://callback');
    expect(redirectTest).toContain('clerkNativeSsoCallbackRedirectUrls');
  });
});
