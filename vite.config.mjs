import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxDev: true,
  },
  test: {
    environment: 'happy-dom',
    setupFiles: './src/tests/setup.ts',
    globals: true,
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
})
