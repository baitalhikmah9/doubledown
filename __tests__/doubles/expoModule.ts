/** Minimal `expo` package double (scheme lookup etc.). */

let runningInExpoGo = false;

export function isRunningInExpoGo(): boolean {
  return runningInExpoGo;
}

export function requireOptionalNativeModule(_name: string): null {
  return null;
}

export function __setIsRunningInExpoGo(next: boolean): void {
  runningInExpoGo = next;
}

export function __resetExpoModuleDouble(): void {
  runningInExpoGo = false;
}

const Expo = {
  isRunningInExpoGo,
  requireOptionalNativeModule,
};

export default Expo;
