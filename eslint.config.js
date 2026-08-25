const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'tools/oxlint/**',
      'coverage/**',
      'convex/_generated/**',
      '.pi/**',
      '.pi-subagents/**',
      '.agent/**',
      '.agents/**',
      '.claude/**',
      '.cursor/**',
      '.codex/**',
      '.commandcode/**',
    ],
  },
  ...expoConfig,
  {
    files: ['**/__tests__/**'],
    rules: {
      // Tests intentionally toggle env keys via bracket access.
      'expo/no-dynamic-env-var': 'off',
    },
  },
];
