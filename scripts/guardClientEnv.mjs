import fs from 'node:fs/promises'
import path from 'node:path'

const CODE_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts'])
const IGNORE_DIRS = new Set(['tests', '__tests__', 'test'])
const IGNORE_FILE_RE = /\.(test|spec)\.(js|jsx|ts|tsx|mjs|cjs|mts|cts)$/

const patterns = [
  { label: 'process.env', re: /\bprocess\.env\b/ },
  { label: 'globalThis.process', re: /\bglobalThis\.process\b/ },
]

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue

    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue
      yield* walk(full)
      continue
    }

    if (!entry.isFile()) continue
    if (IGNORE_FILE_RE.test(entry.name)) continue

    const ext = path.extname(entry.name)
    if (!CODE_EXTS.has(ext)) continue

    yield full
  }
}

function findMatches(content) {
  const lines = content.split(/\r?\n/)
  const hits = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const p of patterns) {
      if (p.re.test(line)) {
        hits.push({ line: i + 1, label: p.label, text: line })
      }
    }
  }

  return hits
}

async function main() {
  const repoRoot = process.cwd()
  const srcDir = path.join(repoRoot, 'src')

  let bad = 0

  for await (const filePath of walk(srcDir)) {
    const content = await fs.readFile(filePath, 'utf8')
    const matches = findMatches(content)

    if (matches.length === 0) continue

    bad++
    const rel = path.relative(repoRoot, filePath)
    console.error(`\n❌ Disallowed client env usage in ${rel}`)
    for (const m of matches) {
      console.error(`  - ${m.label} at line ${m.line}: ${m.text.trim()}`)
    }
  }

  if (bad > 0) {
    console.error(
      `\nGuard failed: found disallowed env usage in ${bad} file(s). ` +
        'Client code must use import.meta.env (Vite).'
    )
    process.exit(1)
  }

  console.log('✅ guard:client-env passed (no disallowed env usage found)')
}

main().catch((err) => {
  console.error('guard:client-env failed with an unexpected error:', err)
  process.exit(1)
})
