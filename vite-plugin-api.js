/**
 * Vite plugin to serve /api/* endpoints during development
 * Mimics Vercel's serverless function behavior for local testing
 */
import { loadEnv } from 'vite'

export function apiPlugin() {
  return {
    name: 'vite-plugin-api',
    configureServer(server) {
      // Ensure serverless handlers (loaded via Node import) can read env vars.
      // Vite normally injects env into client bundles via import.meta.env, but
      // our /api handlers run in Node and rely on process.env.
      try {
        const env = loadEnv(server.config.mode, server.config.root, '')
        for (const [key, value] of Object.entries(env)) {
          if (process.env[key] === undefined) process.env[key] = value
        }
      } catch (e) {
        console.warn('[vite-plugin-api] Failed to load env for /api handlers:', e?.message)
      }

      server.middlewares.use(async (req, res, next) => {
        // Only handle /api/* routes
        if (!req.url?.startsWith('/api/')) {
          return next()
        }

        // Extract pathname without query parameters
        const url = new URL(req.url, 'http://localhost')
        const pathname = url.pathname

        // Remove /api/ prefix and sanitize path to prevent directory traversal
        let apiPath = pathname.replace('/api/', '')

        // Security: Prevent path traversal attacks by blocking '..' segments and multiple slashes
        // Note: Most web servers normalize paths before they reach middleware, but we check as defense-in-depth
        if (apiPath.includes('..') || apiPath.includes('//') || apiPath.includes('\\')) {
          console.warn(`[vite-plugin-api] Blocked suspicious path: ${apiPath}`)
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Bad Request', message: 'Invalid API path' }))
          return
        }

        let handlerPath

        try {
          // Try to load the API handler
          handlerPath = `./api/${apiPath}.js`
          const module = await import(handlerPath)
          const handler = module.default

          if (typeof handler !== 'function') {
            throw new Error(`Handler at ${handlerPath} is not a function`)
          }

          // Execute the handler
          await handler(req, res)
        } catch (error) {
          console.error(`[vite-plugin-api] Error loading handler ${handlerPath}:`, error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: 'Internal Server Error',
              message: error.message,
              handler: handlerPath,
            })
          )
        }
      })
    },
  }
}
