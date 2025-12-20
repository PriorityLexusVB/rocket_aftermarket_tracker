/**
 * Vite plugin to serve /api/* endpoints during development
 * Mimics Vercel's serverless function behavior for local testing
 */
export function apiPlugin() {
  return {
    name: 'vite-plugin-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Only handle /api/* routes
        if (!req.url?.startsWith('/api/')) {
          return next()
        }

        // Map /api/health-deals-rel to the handler
        const apiPath = req.url.replace('/api/', '')
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
