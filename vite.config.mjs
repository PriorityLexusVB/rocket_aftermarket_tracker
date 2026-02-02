import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { apiPlugin } from './vite-plugin-api.js'

export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: {
    // Default to a stable, LAN-reachable dev server.
    // Can be overridden via CLI flags or PORT/VITE_PORT.
    host: '0.0.0.0',
    port: Number(process.env.VITE_PORT || process.env.PORT || 4000),
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
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
  test: {
    environment: 'jsdom',
    setupFiles: ['src/tests/setup.ts'],
    globals: true,
  },
})
