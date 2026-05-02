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
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-dom')) return 'vendor-react'
          if (/[\\/]react[\\/]/.test(id) || /[\\/]scheduler[\\/]/.test(id)) return 'vendor-react'
          if (id.includes('react-router')) return 'vendor-router'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('lucide-react')) return 'vendor-icons'
          if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-')) return 'vendor-charts'
          if (id.includes('framer-motion')) return 'vendor-animation'
          if (id.includes('@reduxjs/toolkit') || /[\\/]redux[\\/]/.test(id)) return 'vendor-redux'
          if (id.includes('react-hook-form') || id.includes('@hookform') || /[\\/]zod[\\/]/.test(id))
            return 'vendor-forms'
          if (id.includes('date-fns')) return 'vendor-date'
          if (id.includes('drizzle-')) return 'vendor-drizzle'
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
