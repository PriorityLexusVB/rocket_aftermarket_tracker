import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  test: {
    // Use a browser-like environment for DOM and window/navigator references
    environment: 'jsdom',
    // Run only core unit tests for fast, stable CI; Playwright E2E runs via `pnpm e2e`
    include: ['src/tests/dealService.*.test.js', 'src/tests/dealForm.*.test.jsx'],
    exclude: ['e2e/**', 'tests/e2e/**', 'playwright/**', 'node_modules/**', 'dist/**'],
    setupFiles: ['src/tests/setup.ts'],
    reporters: 'default',
  },
})
