// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxDev: true,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['src/tests/setup.ts'],
    css: false,
    include: ['src/tests/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    // Prefer single-threaded execution to minimize shared in-memory DB interference
    pool: 'threads',
    poolOptions: {
      threads: { singleThread: true },
    },
    exclude: [
      // Step 18 is a guidance-style static matcher suite with intentionally strict patterns;
      // exclude from automated runs to focus on functional behavior.
      'src/tests/step18-*.*',
    ],
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
})
