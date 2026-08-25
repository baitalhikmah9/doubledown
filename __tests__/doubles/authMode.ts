/** Controllable test double for `@/lib/authMode` (wired via jest moduleNameMapper). */

let authDisabled = false;

export function isAuthDisabled(): boolean {
  return authDisabled;
}

export function __setAuthDisabled(next: boolean): void {
  authDisabled = next;
}

export function __resetAuthModeDouble(): void {
  authDisabled = false;
}
