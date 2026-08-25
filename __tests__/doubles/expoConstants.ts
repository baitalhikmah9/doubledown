/** Minimal expo-constants double. */

type ExpoConfig = {
  extra: Record<string, string | number | boolean | null>;
  scheme: string;
  android?: { package?: string };
  ios?: { bundleIdentifier?: string };
} | null;

let expoConfig: ExpoConfig = {
  extra: {},
  scheme: 'backfire',
  android: { package: 'com.playbackfire.app' },
  ios: { bundleIdentifier: 'com.playbackfire.app' },
};

let debugMode = false;

const constants = {
  // SAFETY: Controlled test boundary cast under fixture invariants.
  appOwnership: 'standalone' as string | null,
  get debugMode() {
    return debugMode;
  },
  set debugMode(next: boolean) {
    debugMode = next;
  },
  executionEnvironment: 'standalone',
  get expoConfig() {
    return expoConfig;
  },
  set expoConfig(next: ExpoConfig) {
    expoConfig = next;
  },
  expoVersion: '55.0.0',
  isDevice: true,
  platform: { ios: undefined, android: undefined },
  sessionId: 'test-session',
  statusBarHeight: 0,
  // SAFETY: Controlled test boundary cast under fixture invariants.
  systemFonts: [] as string[],
  systemVersion: '17.0',
};

export default constants;

export function __setExpoConstants(next: {
  debugMode?: boolean;
  expoConfig?: ExpoConfig;
  appOwnership?: string | null;
}): void {
  if (next.debugMode !== undefined) debugMode = next.debugMode;
  if (next.expoConfig !== undefined) expoConfig = next.expoConfig;
  if (next.appOwnership !== undefined) constants.appOwnership = next.appOwnership;
}

export function __resetExpoConstantsDouble(): void {
  debugMode = false;
  expoConfig = {
    extra: {},
    scheme: 'backfire',
    android: { package: 'com.playbackfire.app' },
    ios: { bundleIdentifier: 'com.playbackfire.app' },
  };
  constants.appOwnership = 'standalone';
}
