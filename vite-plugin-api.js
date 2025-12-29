/**
 * Vite plugin to serve /api/* endpoints during development
 * Mimics Vercel's serverless function behavior for local testing
 */
export function apiPlugin() {
  return {
    name: 'vite-plugin-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // If another middleware already ended the response, do nothing.
        if (res.writableEnded) return

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

          // If the response has already started (unlikely here), do not attempt to write headers/body.
          if (res.headersSent || res.writableEnded) return

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
          try {
            await handler(req, res)
          } catch (handlerError) {
            // Many handlers write an error response and then throw; if headers are already sent,
            // we must not try to set headers again or the dev server can crash.
            if (res.headersSent || res.writableEnded) {
              console.error(
                `[vite-plugin-api] Handler threw after response started for ${handlerPath}:`,
                handlerError
              )
              return
            }
            throw handlerError
          }
        } catch (error) {
          console.error(`[vite-plugin-api] Error loading handler ${handlerPath}:`, error)

          // If the handler already started sending a response, do not attempt to send a second one.
          // This prevents ERR_HTTP_HEADERS_SENT from crashing the Vite dev server.
          if (res.headersSent || res.writableEnded) return

          try {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: 'Internal Server Error',
                message: error?.message || String(error),
                handler: handlerPath,
              })
            )
          } catch (writeErr) {
            console.error(
              `[vite-plugin-api] Failed to write error response for ${handlerPath}:`,
              writeErr
            )
          }
        }
      })
    },
  }
}
