require('@testing-library/jest-native/extend-expect');

// Reset shared doubles between tests so file order does not leak state.
const { beforeEach } = require('@jest/globals');

beforeEach(() => {
  try {
    require('./__tests__/doubles/authMode').__resetAuthModeDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/deviceInstallation').__resetDeviceInstallationDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/expoRouter').__resetExpoRouterDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/useI18n').__resetUseI18nDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/clerkExpo').__resetClerkExpoDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/convexReact').__resetConvexReactDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/asyncStorage').__resetAsyncStorageDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/safeArea').__resetSafeAreaDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/expoHaptics').__resetExpoHapticsDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/expoSecureStore').__resetSecureStoreDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/windowDimensions').__resetWindowDimensionsDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/featureFlags').__resetFeatureFlagsDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/expoConstants').__resetExpoConstantsDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/expoAuthSession').__resetExpoAuthSessionDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/expoModule').__resetExpoModuleDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/haptics').__resetHapticsDouble?.();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/themedAlert').__resetThemedAlertDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/appleSignIn').__resetAppleSignInDouble();
  } catch {
    /* optional */
  }
  try {
    require('./__tests__/doubles/useTheme').__resetUseThemeDouble();
  } catch {
    /* optional */
  }
});
