import dotenv from 'dotenv'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Ensure E2E_* env vars are available in Playwright worker processes when running locally.
// In CI, secrets should be provided via environment; .env.local is typically absent.
try {
  const findUp = (fileName: string, startDir: string) => {
    let dir = startDir
    for (let i = 0; i < 12; i++) {
      const candidate = path.join(dir, fileName)
      if (existsSync(candidate)) return candidate

      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    return null
  }

  const thisDir = path.dirname(fileURLToPath(import.meta.url))
  const startDirs = [process.cwd(), thisDir]
  if (process.env.PWD) startDirs.unshift(process.env.PWD)
  const seen = new Set<string>()
  const debug = process.env.DEBUG_E2E_ENV === '1'

  for (const start of startDirs) {
    for (const fileName of ['.env.local', '.env']) {
      const found = findUp(fileName, start)
      if (found && !seen.has(found)) {
        dotenv.config({ path: found })
        seen.add(found)
        if (debug) {
          // eslint-disable-next-line no-console
          console.log('[e2e/_authEnv] loaded', fileName, 'from', found)
        }
      }
    }
  }

  if (debug) {
    // eslint-disable-next-line no-console
    console.log('[e2e/_authEnv] PWD', process.env.PWD)
    // eslint-disable-next-line no-console
    console.log('[e2e/_authEnv] cwd', process.cwd())
    // eslint-disable-next-line no-console
    console.log('[e2e/_authEnv] has E2E_EMAIL', Boolean(process.env.E2E_EMAIL))
    // eslint-disable-next-line no-console
    console.log('[e2e/_authEnv] has E2E_PASSWORD', Boolean(process.env.E2E_PASSWORD))
  }
} catch {
  // ignore
}

export const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD

export function requireAuthEnv() {
  const missing: string[] = []
  if (!process.env.E2E_EMAIL) missing.push('E2E_EMAIL')
  if (!process.env.E2E_PASSWORD) missing.push('E2E_PASSWORD')

  if (missing.length > 0) {
    throw new Error(
      `[E2E] Missing required auth env vars: ${missing.join(
        ', '
      )}. Set them in CI secrets or in .env.local (repo root) and re-run Playwright.`
    )
  }

  return {
    email: process.env.E2E_EMAIL as string,
    password: process.env.E2E_PASSWORD as string,
  }
}
