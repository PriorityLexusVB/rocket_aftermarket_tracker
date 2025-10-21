// Minimal Vite programmatic starter to avoid shell wrapper path issues on Windows
const { createServer } = require('vite')

async function run() {
  const server = await createServer({
    root: process.cwd(),
    server: {
      host: true,
      port: 5173,
    },
    logLevel: 'info',
  })

  await server.listen()
  server.printUrls()
}

run().catch((err) => {
  console.error('Failed to start Vite programmatically:', err)
  process.exit(1)
})
