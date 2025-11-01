// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['src/tests/setup.ts'],
    css: false,
    include: ['src/tests/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  },
})
