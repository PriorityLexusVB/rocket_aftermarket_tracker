$ErrorActionPreference = "Stop"
$dest = Join-Path $PSScriptRoot "..\.vscode_state"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$roots = @(
  "$env:APPDATA\Code\User\globalStorage\github.copilot-chat",
  "$env:APPDATA\Code\User\globalStorage\GitHub.copilot-chat"
) | Where-Object { Test-Path $_ }

if ($roots.Count -eq 0) { Write-Host "No Copilot chat storage found."; exit 0 }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zip = Join-Path $dest "copilot-chat-$stamp.zip"
Compress-Archive -Path ($roots | ForEach-Object { Join-Path $_ "*" }) -DestinationPath $zip -Force
Write-Host "Saved $zip"
