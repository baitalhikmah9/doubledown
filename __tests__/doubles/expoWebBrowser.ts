/** Controllable test double for `expo-web-browser`. */

export const openAuthSessionAsync = jest.fn(async () => ({
  type: 'success' as const,
  url: 'backfire:///sso-callback?rotating_token_nonce=nonce_1',
}));

export const dismissBrowser = jest.fn(async () => undefined);
export const maybeCompleteAuthSession = jest.fn(() => ({ type: 'success' as const }));
export const warmUpAsync = jest.fn(async () => undefined);
export const coolDownAsync = jest.fn(async () => undefined);

export function __resetExpoWebBrowserDouble(): void {
  openAuthSessionAsync.mockReset();
  openAuthSessionAsync.mockResolvedValue({
    type: 'success',
    url: 'backfire:///sso-callback?rotating_token_nonce=nonce_1',
  });
  dismissBrowser.mockReset();
  dismissBrowser.mockResolvedValue(undefined);
  maybeCompleteAuthSession.mockClear();
  warmUpAsync.mockClear();
  coolDownAsync.mockClear();
}
