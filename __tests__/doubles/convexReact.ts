/** Controllable test double for `convex/react`. */

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type FunctionRef = { _name?: string };
type MutationFn = (args?: Record<string, JsonValue>) => Promise<JsonValue | { ok: boolean; reservationId?: string }>;
type ActionFn = (args?: Record<string, JsonValue>) => Promise<JsonValue | { ok: boolean }>;
type QueryResult = JsonValue | undefined | null;

const defaultMutation: MutationFn = async (args) => {
  if (args && 'clientSessionId' in args) {
    return { ok: true, reservationId: 'test_reservation' };
  }
  if (args && 'reservationId' in args && 'completedSessionId' in args) {
    return { ok: true };
  }
  if (args && 'reservationId' in args && 'reason' in args) {
    return { ok: true };
  }
  if (args && 'reservationId' in args && 'additionalCost' in args) {
    return { ok: true };
  }
  return { ok: true };
};

const defaultAction: ActionFn = async () => ({ ok: true });

let mutationImpl: MutationFn = defaultMutation;
let actionImpl: ActionFn = defaultAction;
let queryResult: QueryResult = undefined;
let authState = { isAuthenticated: true, isLoading: false };

const useMutationMock = jest.fn(() => mutationImpl);
const useActionMock = jest.fn(() => actionImpl);
const useQueryMock = jest.fn(() => queryResult);
const useConvexAuthMock = jest.fn(() => authState);

export function useMutation(_ref?: FunctionRef) {
  return useMutationMock();
}

export function useAction(_ref?: FunctionRef) {
  return useActionMock();
}

export function useQuery(_ref?: FunctionRef, _args?: Record<string, JsonValue> | 'skip') {
  return useQueryMock();
}

export function useConvexAuth() {
  return useConvexAuthMock();
}

export function ConvexProvider({ children }: { children?: React.ReactNode }) {
  return children ?? null;
}

export function __setConvexMutation(next: MutationFn): void {
  mutationImpl = next;
}

export function __setConvexAction(next: ActionFn): void {
  actionImpl = next;
}

export function __setConvexQueryResult(next: QueryResult): void {
  queryResult = next;
}

export function __setConvexAuthState(next: { isAuthenticated: boolean; isLoading: boolean }): void {
  authState = next;
}

export function __getConvexMocks() {
  return {
    useMutationMock,
    useActionMock,
    useQueryMock,
    useConvexAuthMock,
  };
}

export function __resetConvexReactDouble(): void {
  mutationImpl = defaultMutation;
  actionImpl = defaultAction;
  queryResult = undefined;
  authState = { isAuthenticated: true, isLoading: false };
  useMutationMock.mockClear();
  useActionMock.mockClear();
  useQueryMock.mockClear();
  useConvexAuthMock.mockClear();
}
