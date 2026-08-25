export const makeRedirectUri = jest.fn(
  (_opts?: { path?: string; isTripleSlashed?: boolean }) =>
    'exp://192.168.1.10:8081/--/sso-callback'
);
export const AuthRequest = jest.fn();
export const ResponseType = { Code: 'code', Token: 'token' } as const;
export const Prompt = { Login: 'login' } as const;

export function __resetExpoAuthSessionDouble(): void {
  makeRedirectUri.mockReset();
  makeRedirectUri.mockReturnValue('exp://192.168.1.10:8081/--/sso-callback');
}
