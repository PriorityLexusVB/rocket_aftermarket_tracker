$ErrorActionPreference = "Stop"
Write-Host "==> Enabling corepack/pnpm"
corepack enable | Out-Null

Write-Host "==> Installing recommended VS Code extensions"
$exts = @(
  "github.copilot",
  "github.copilot-chat",
  "dbaeumer.vscode-eslint",
  "esbenp.prettier-vscode",
  "ms-vscode.vscode-typescript-next",
  "streetsidesoftware.code-spell-checker"
)
foreach ($e in $exts) {
  try { code --install-extension $e | Out-Null } catch {}
}

Write-Host "==> Installing project dependencies"
pnpm i

Write-Host "Done. If prompted, use: 'Dev Containers: Reopen in Container' for identical env."
