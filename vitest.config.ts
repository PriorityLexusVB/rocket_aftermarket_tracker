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
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
})
