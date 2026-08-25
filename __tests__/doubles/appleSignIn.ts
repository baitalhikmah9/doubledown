export const isAppleSignInAvailable = jest.fn(async () => false);
export const signInWithApple = jest.fn(async () => ({
  identityToken: 'token',
  fullName: null,
}));

export function __resetAppleSignInDouble(): void {
  isAppleSignInAvailable.mockReset();
  isAppleSignInAvailable.mockResolvedValue(false);
  signInWithApple.mockReset();
  signInWithApple.mockResolvedValue({ identityToken: 'token', fullName: null });
}
