import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(process.cwd())

function read(relPath) {
  const absPath = path.join(repoRoot, relPath)
  try {
    return fs.readFileSync(absPath, 'utf8')
  } catch (error) {
    throw new Error(`guard:instructions failed to read ${relPath}: ${error.message}`)
  }
}

function mustInclude(content, relPath, needle) {
  if (!content.includes(needle)) {
    throw new Error(`guard:instructions: ${relPath} must include: ${needle}`)
  }
}

function mustNotInclude(content, relPath, needle) {
  if (content.includes(needle)) {
    throw new Error(`guard:instructions: ${relPath} must NOT include: ${needle}`)
  }
}

function main() {
  const guardrailsQuick =
    '.github/instructions/Aftermarket – Workspace Guardrails (DO NOT DEVIATE).instructions.md'
  const masterPrompt = 'MASTER_EXECUTION_PROMPT.md'
  const quickStart = 'docs/QUICK_START_DEVELOPMENT.md'

  const guardrailsQuickContent = read(guardrailsQuick)
  const masterPromptContent = read(masterPrompt)
  const quickStartContent = read(quickStart)

  // Guardrails quick doc should be durable and non-task-specific.
  mustNotInclude(guardrailsQuickContent, guardrailsQuick, 'fix/dropdowns-guarded')
  mustInclude(guardrailsQuickContent, guardrailsQuick, '.github/copilot-instructions.md')
  mustInclude(guardrailsQuickContent, guardrailsQuick, 'AGENTS.md')
  mustInclude(guardrailsQuickContent, guardrailsQuick, '.github/WORKFLOWS_AGENT_PREFLIGHT.md')

  // Master prompt should point to the actual guardrails file location.
  mustNotInclude(masterPromptContent, masterPrompt, 'copilot-instructions.md (root directory)')
  mustInclude(masterPromptContent, masterPrompt, '.github/copilot-instructions.md')

  // Prefer Corepack guidance over global installs.
  mustNotInclude(masterPromptContent, masterPrompt, 'npm install -g pnpm')
  mustNotInclude(quickStartContent, quickStart, 'npm install -g pnpm')

  process.stdout.write('✅ guard:instructions passed (guardrail docs aligned)\n')
}

try {
  main()
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exit(1)
}
