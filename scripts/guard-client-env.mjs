import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = path.resolve(process.cwd())
const srcRoot = path.join(repoRoot, 'src')

const SKIP_DIRS = new Set(['src/tests'])
const SKIP_FILE_RE = /\.(test|spec)\.(js|jsx|ts|tsx)$/
const FILE_RE = /\.(js|jsx|ts|tsx)$/

const forbiddenPatterns = [
  { re: /\bprocess\b/g, label: 'process' },
  { re: /\bprocess\s*\.\s*env\b/g, label: 'process.env' },
  { re: /\bglobalThis\s*\.\s*process\b/g, label: 'globalThis.process' },
]

function stripCommentsAndStrings(code) {
  // Best-effort: remove strings and comments to avoid false positives.
  // Not a full JS parser, but sufficient for guarding obvious identifier usage.
  return (
    code
      // block comments
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      // line comments
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      // template literals (best-effort, non-greedy)
      .replace(/`[\s\S]*?`/g, ' ')
      // single-quoted strings
      .replace(/'(?:\\.|[^'\\])*'/g, ' ')
      // double-quoted strings
      .replace(/"(?:\\.|[^"\\])*"/g, ' ')
  )
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const results = []
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    const rel = path.relative(repoRoot, full).replace(/\\/g, '/')

    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(rel)) continue
      results.push(...(await walk(full)))
      continue
    }

    if (!FILE_RE.test(ent.name)) continue
    if (SKIP_FILE_RE.test(ent.name)) continue

    results.push({ full, rel })
  }
  return results
}

async function main() {
  const files = await walk(srcRoot)

  const violations = []
  for (const { full, rel } of files) {
    const raw = await fs.readFile(full, 'utf8')
    const code = stripCommentsAndStrings(raw)

    for (const { re, label } of forbiddenPatterns) {
      re.lastIndex = 0
      if (re.test(code)) {
        violations.push({ file: rel, rule: label })
      }
    }
  }

  if (violations.length) {
    const lines = violations
      .map((v) => `- ${v.file} (${v.rule})`)
      .sort()
      .join('\n')

    console.error('❌ guard:client-env failed. Forbidden client env references found in src/**:')
    console.error(lines)
    process.exit(1)
  }

  console.log('✅ guard:client-env passed (no forbidden client env references in src/**)')
}

main().catch((err) => {
  console.error('❌ guard:client-env errored:', err)
  process.exit(1)
})
