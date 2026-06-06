#!/usr/bin/env node
/**
 * Wave XXX-AL: DESIGN.md enforcement script.
 *
 * Scans src/pages/** for anti-patterns documented in docs/DESIGN.md and
 * fails CI/verify if any new ones land. Treats specific allow-list locations
 * (hero/feature surfaces) as intentional. Run: `pnpm design-lint`.
 *
 * Exits 0 if clean, 1 if violations found.
 *
 * Uses zero deps — Node's built-in fs only.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const scanRoot = join(repoRoot, 'src', 'pages')

// Anti-patterns — { name, pattern: RegExp, msg, allowFiles: posix-style rel paths }
const RULES = [
  {
    name: 'rounded-2xl outside hero/feature surfaces',
    pattern: /\brounded-2xl\b/,
    msg: 'Use rounded-lg (cards) or rounded-xl (hero/feature). rounded-2xl reserved for hero only.',
    allowFiles: [
      'src/pages/calendar/CalendarShell.jsx',
      'src/pages/how-it-works/index.jsx',
      'src/pages/guest-claims-submission-form/index.jsx',
      // dark hero strip (bg-lex-brand) — intentional hero/feature surface per DESIGN.md
      'src/pages/dashboard/index.jsx',
    ],
  },
  {
    name: 'pt-20 or pt-24 on page wrapper',
    pattern: /\bpt-2[04]\b/,
    msg: 'AppLayout owns fixed-nav offset. Page wrappers must not add pt-20/pt-24.',
    allowFiles: [],
  },
  {
    name: 'bg-green-600 (use bg-emerald-600 for success actions)',
    pattern: /\bbg-green-600\b/,
    msg: 'Use bg-emerald-600 for success actions. bg-green-600 banned for visual consistency.',
    allowFiles: [
      // status badges intentionally use green for "approved" — domain color, not a button
      'src/pages/claims-management-center/index.jsx',
      // filter chips intentionally use green for "completed" status — domain semantic, not a button
      'src/pages/calendar-flow-management-center/components/QuickFilters.jsx',
    ],
  },
  {
    name: 'rounded-none / rounded-0',
    pattern: /\brounded-(?:none|0)\b/,
    msg: 'Use rounded-lg standard. Square corners banned.',
    allowFiles: [],
  },
]

const FILE_RE = /\.(js|jsx|ts|tsx)$/

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if (FILE_RE.test(entry)) out.push(p)
  }
  return out
}

function main() {
  const files = walk(scanRoot, [])
  let violations = 0

  for (const file of files) {
    const rel = relative(repoRoot, file).replace(/\\/g, '/')
    const src = readFileSync(file, 'utf8')
    const lines = src.split('\n')

    for (const rule of RULES) {
      if (rule.allowFiles.includes(rel)) continue
      for (let i = 0; i < lines.length; i++) {
        if (rule.pattern.test(lines[i])) {
          violations++
          console.log(`[31m✗[0m ${rel}:${i + 1} — ${rule.name}`)
          console.log(`  ${lines[i].trim().slice(0, 120)}`)
          console.log(`  [2m${rule.msg}[0m`)
        }
      }
    }
  }

  if (violations === 0) {
    console.log(
      `[32m✓[0m design-lint: zero violations across ${files.length} files`,
    )
    process.exit(0)
  }

  console.log(
    `\n[31m✗ design-lint: ${violations} violation(s) across ${files.length} files[0m`,
  )
  console.log('\nFix the issues above or add the file to the rule\'s allowFiles list (with comment).')
  console.log('See docs/DESIGN.md for the design rules.')
  process.exit(1)
}

main()
