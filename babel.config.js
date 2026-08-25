module.exports = function (api) {
  const isTest = api.env('test');
  api.cache.using(() => (isTest ? 'test' : 'runtime'));
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Metro web serves the bundle as a classic script (no type="module").
          // Dependencies using `import.meta` must be rewritten or the browser throws.
          unstable_transformImportMeta: true,
        },
      ],
    ],
    plugins: isTest
      ? []
      : [
          // Metro resolves `@/` via tsconfig paths + this plugin in app builds.
          // Skipped under Jest so moduleNameMapper doubles can intercept `@/` imports.
          [
            'module-resolver',
            {
              root: ['.'],
              alias: {
                '@': '.',
              },
            },
          ],
        ],
  };
};
