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

let clerkClient: { id: string } = { id: 'client_live_test' };
const reloadInitialResources = jest.fn(async () => undefined);

export function useClerk() {
  return {
    signOut: authState.signOut,
    get client() {
      return clerkClient;
    },
    __internal_reloadInitialResources: reloadInitialResources,
  };
}

export function __setClerkClient(next: { id: string }): void {
  clerkClient = next;
}

export function __getClerkReloadInitialResources() {
  return reloadInitialResources;
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
const setActive = jest.fn(async () => undefined);

const signInState = {
  createdSessionId: 'sess_1' as string | null,
  firstFactorVerification: {
    status: 'unverified' as string | null,
    externalVerificationRedirectURL: 'https://accounts.google.com/o/oauth2/auth?test=1' as string | null,
  },
};

const signInCreate = jest.fn(async () => undefined);
const signInReload = jest.fn(async () => undefined);
const signUpCreate = jest.fn(async () => undefined);

export function useSignIn() {
  return {
    isLoaded: true,
    signIn: {
      create: signInCreate,
      reload: signInReload,
      prepareFirstFactor: jest.fn(),
      attemptFirstFactor: jest.fn(),
      authenticateWithRedirect,
      get createdSessionId() {
        return signInState.createdSessionId;
      },
      get firstFactorVerification() {
        return signInState.firstFactorVerification;
      },
    },
    setActive,
  };
}

export function __getClerkAuthenticateWithRedirect() {
  return authenticateWithRedirect;
}

export function __getClerkSignInCreate() {
  return signInCreate;
}

export function __getClerkSignInReload() {
  return signInReload;
}

export function __getClerkSetActive() {
  return setActive;
}

export function __setClerkSignInVerification(next: {
  status?: string | null;
  externalVerificationRedirectURL?: string | null;
  createdSessionId?: string | null;
}): void {
  if (next.status !== undefined) {
    signInState.firstFactorVerification.status = next.status;
  }
  if (next.externalVerificationRedirectURL !== undefined) {
    signInState.firstFactorVerification.externalVerificationRedirectURL =
      next.externalVerificationRedirectURL;
  }
  if (next.createdSessionId !== undefined) {
    signInState.createdSessionId = next.createdSessionId;
  }
}

export function useSignUp() {
  return {
    isLoaded: true,
    signUp: {
      create: signUpCreate,
      prepareEmailAddressVerification: jest.fn(),
      attemptEmailAddressVerification: jest.fn(),
      createdSessionId: null as string | null,
    },
    setActive,
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
  signInCreate.mockReset();
  signInCreate.mockResolvedValue(undefined);
  signInReload.mockReset();
  signInReload.mockResolvedValue(undefined);
  signUpCreate.mockReset();
  signUpCreate.mockResolvedValue(undefined);
  setActive.mockReset();
  setActive.mockResolvedValue(undefined);
  reloadInitialResources.mockReset();
  reloadInitialResources.mockResolvedValue(undefined);
  clerkClient = { id: 'client_live_test' };
  signInState.createdSessionId = 'sess_1';
  signInState.firstFactorVerification = {
    status: 'unverified',
    externalVerificationRedirectURL: 'https://accounts.google.com/o/oauth2/auth?test=1',
  };
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
