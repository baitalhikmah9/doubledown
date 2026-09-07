module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // Specific doubles MUST come before the `@/` catch-all.
    '^@/lib/authMode$': '<rootDir>/__tests__/doubles/authMode.ts',
    '^@/lib/deviceInstallation$': '<rootDir>/__tests__/doubles/deviceInstallation.ts',
    '^@/lib/i18n/useI18n$': '<rootDir>/__tests__/doubles/useI18n.ts',
    '^@/lib/hooks/useTheme$': '<rootDir>/__tests__/doubles/useTheme.ts',
    '^@/features/play/components/PlayScaffold$': '<rootDir>/__tests__/doubles/playScaffold.tsx',
    '^@/components/BackfireTitleLogo$': '<rootDir>/__tests__/doubles/backfireTitleLogo.tsx',
    '^expo-router$': '<rootDir>/__tests__/doubles/expoRouter.ts',
    '^@clerk/clerk-expo$': '<rootDir>/__tests__/doubles/clerkExpo.ts',
    '^convex/react$': '<rootDir>/__tests__/doubles/convexReact.ts',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__tests__/doubles/asyncStorage.ts',
    '^react-native-safe-area-context$': '<rootDir>/__tests__/doubles/safeArea.ts',
    '^@expo/vector-icons$': '<rootDir>/__tests__/doubles/vectorIcons.tsx',
    '^expo-image$': '<rootDir>/__tests__/doubles/expoImage.tsx',
    '^expo-haptics$': '<rootDir>/__tests__/doubles/expoHaptics.ts',
    '^expo-secure-store$': '<rootDir>/__tests__/doubles/expoSecureStore.ts',
    '^expo-web-browser$': '<rootDir>/__tests__/doubles/expoWebBrowser.ts',
    '^expo-constants$': '<rootDir>/__tests__/doubles/expoConstants.ts',
    '^expo-auth-session$': '<rootDir>/__tests__/doubles/expoAuthSession.ts',
    '^expo$': '<rootDir>/__tests__/doubles/expoModule.ts',
    '^@revenuecat/purchases-js$': '<rootDir>/__tests__/doubles/revenueCatPurchasesJs.ts',
    '^react-native/Libraries/Utilities/useWindowDimensions$':
      '<rootDir>/__tests__/doubles/windowDimensions.ts',
    '^@/constants/featureFlags$': '<rootDir>/__tests__/doubles/featureFlags.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  // Do not treat doubles/helpers as test suites.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/doubles/',
    '/__tests__/helpers/',
  ],
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'store/**/*.{ts,tsx}',
    'types/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
};
