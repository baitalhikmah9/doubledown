export const getClerkOAuthRedirectUrl = jest.fn(() => 'backfire://oauth');
export const warmUpClerkOAuthBrowser = jest.fn(async () => undefined);
export const coolDownClerkOAuthBrowser = jest.fn(async () => undefined);

export function __resetClerkOAuthRedirectDouble(): void {
  getClerkOAuthRedirectUrl.mockReset();
  getClerkOAuthRedirectUrl.mockReturnValue('backfire://oauth');
  warmUpClerkOAuthBrowser.mockReset();
  warmUpClerkOAuthBrowser.mockResolvedValue(undefined);
  coolDownClerkOAuthBrowser.mockReset();
  coolDownClerkOAuthBrowser.mockResolvedValue(undefined);
}
