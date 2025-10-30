$ErrorActionPreference = "Stop"
# Ensure corepack/pnpm
corepack enable
# Recommended extensions (re-applied even if Settings Sync misses any)
$exts = @(
  "github.copilot",
  "github.copilot-chat",
  "dbaeumer.vscode-eslint",
  "esbenp.prettier-vscode"
)
foreach ($e in $exts) { code --install-extension $e | Out-Null }

# Install deps
pnpm i
Write-Host "Workspace ready. If you see a prompt, choose 'Reopen in Container'."
