import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': '/src' } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/tests/setup.ts'],
    include: ['src/tests/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    css: false,
  },
})
