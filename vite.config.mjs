import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { apiPlugin } from './vite-plugin-api.js'

export default defineConfig({
  define: {
    __BUILD_SHA__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || ''),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    apiPlugin(),
    {
      name: 'inject-build-meta',
      transformIndexHtml(html) {
        const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || ''
        const sha7 = sha ? sha.slice(0, 7) : ''
        const time = new Date().toISOString()
        const tags = [
          `<meta name="x-build-sha" content="${sha7}">`,
          `<meta name="x-build-time" content="${time}">`,
        ].join('')

        if (html.includes('name="x-build-sha"')) return html
        return html.replace('</head>', `${tags}</head>`)
      },
    },
  ],
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
