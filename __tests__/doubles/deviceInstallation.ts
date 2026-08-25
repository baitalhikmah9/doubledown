/** Controllable test double for `@/lib/deviceInstallation`. */

let installationId = 'device_test_1';

export async function getOrCreateInstallationId(): Promise<string> {
  return installationId;
}

export function __setInstallationId(next: string): void {
  installationId = next;
}

export function __resetDeviceInstallationDouble(): void {
  installationId = 'device_test_1';
}
