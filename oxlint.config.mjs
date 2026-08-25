import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/.expo/**",
    "**/android/**",
    "**/ios/**",
    "**/.agent/**",
    "**/.agents/**",
    "**/.claude/**",
    "**/.codex/**",
    "**/.commandcode/**",
    "**/.continue/**",
    "**/.cursor/**",
    "**/.gemini/**",
    "**/.opencode/**",
    "**/.pi/**",
    "**/.pi-subagents/**",
    "**/.roo/**",
    "**/.windsurf/**",
    "**/tools/oxlint/**",
    "**/convex/_generated/**",
  ],
  jsPlugins: [
    { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
  ],
  rules: {
    // High-signal only. Blanket typeof/unknown/SAFETY-comment rules caused
    // HostValue theater and noisy mass casts without improving correctness.
    // no-module-mocking is not enabled: its useful target is test files, and the
    // suite intentionally uses moduleNameMapper doubles + a few legacy jest.mock
    // seams. Enabling it while excluding tests would be dead configuration.
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-widen-then-assert": "error",
  },
});
