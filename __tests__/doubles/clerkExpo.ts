/** Controllable test double for `@clerk/clerk-expo`. */

type AuthState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  signOut: jest.Mock | undefined;
};

type UserResource = {
  id: string;
  primaryEmailAddress?: { emailAddress: string } | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  imageUrl?: string | null;
};

const defaultSignOut = jest.fn(async () => undefined);

let authState: AuthState = {
  isLoaded: true,
  isSignedIn: true,
  userId: 'user_test_1',
  signOut: defaultSignOut,
};

let user: UserResource | null = {
  id: 'user_test_1',
  primaryEmailAddress: { emailAddress: 'fan@example.com' },
  fullName: 'Test Fan',
  firstName: 'Test',
  lastName: 'Fan',
  imageUrl: null,
};

const startOAuthFlow = jest.fn(async () => ({
  createdSessionId: 'sess_1',
  setActive: jest.fn(async () => undefined),
  authSessionResult: null,
}));

export function useAuth() {
  return authState;
}

let userLoaded = true;

export function useUser() {
  return { isLoaded: userLoaded, isSignedIn: authState.isSignedIn, user };
}

export function __setClerkUserLoaded(next: boolean): void {
  userLoaded = next;
}

export function useClerk() {
  return { signOut: authState.signOut };
}

export function useOAuth(_args: { strategy: string }) {
  return { startOAuthFlow };
}

const startSSOFlow = jest.fn(async () => ({
  createdSessionId: 'sess_1',
  setActive: jest.fn(async () => undefined),
  authSessionResult: null,
}));

const startAppleAuthenticationFlow = jest.fn(async () => ({
  createdSessionId: 'sess_apple',
  setActive: jest.fn(async () => undefined),
}));

export function useSSO() {
  return { startSSOFlow };
}

export function useSignInWithApple() {
  return { startAppleAuthenticationFlow };
}

export function __getClerkStartSSOFlow() {
  return startSSOFlow;
}

export function __getClerkStartAppleAuthenticationFlow() {
  return startAppleAuthenticationFlow;
}

const authenticateWithRedirect = jest.fn(async () => undefined);

export function useSignIn() {
  return {
    isLoaded: true,
    signIn: {
      create: jest.fn(),
      prepareFirstFactor: jest.fn(),
      attemptFirstFactor: jest.fn(),
      authenticateWithRedirect,
    },
    setActive: jest.fn(),
  };
}

export function __getClerkAuthenticateWithRedirect() {
  return authenticateWithRedirect;
}

export function useSignUp() {
  return {
    isLoaded: true,
    signUp: {
      create: jest.fn(),
      prepareEmailAddressVerification: jest.fn(),
      attemptEmailAddressVerification: jest.fn(),
    },
    setActive: jest.fn(),
  };
}

export function ClerkProvider({ children }: { children?: React.ReactNode }) {
  return children ?? null;
}

export function __setClerkAuth(next: Partial<AuthState>): void {
  authState = {
    ...authState,
    ...next,
    signOut: next.signOut ?? authState.signOut,
  };
}

export function __setClerkUser(next: UserResource | null): void {
  user = next;
}

export function __getClerkStartOAuthFlow() {
  return startOAuthFlow;
}

export function __resetClerkExpoDouble(): void {
  defaultSignOut.mockClear();
  startOAuthFlow.mockReset();
  startOAuthFlow.mockResolvedValue({
    createdSessionId: 'sess_1',
    setActive: jest.fn(async () => undefined),
    authSessionResult: null,
  });
  startSSOFlow.mockReset();
  startSSOFlow.mockResolvedValue({
    createdSessionId: 'sess_1',
    setActive: jest.fn(async () => undefined),
    authSessionResult: null,
  });
  startAppleAuthenticationFlow.mockReset();
  startAppleAuthenticationFlow.mockResolvedValue({
    createdSessionId: 'sess_apple',
    setActive: jest.fn(async () => undefined),
  });
  authenticateWithRedirect.mockReset();
  authenticateWithRedirect.mockResolvedValue(undefined);
  authState = {
    isLoaded: true,
    isSignedIn: true,
    userId: 'user_test_1',
    signOut: defaultSignOut,
  };
  userLoaded = true;
  user = {
    id: 'user_test_1',
    primaryEmailAddress: { emailAddress: 'fan@example.com' },
    fullName: 'Test Fan',
    firstName: 'Test',
    lastName: 'Fan',
    imageUrl: null,
  };
}
