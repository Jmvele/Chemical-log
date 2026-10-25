$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
  & $nodeCommand.Source 'server.mjs'
} else {
  $bundledNode = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
  if (Test-Path -LiteralPath $bundledNode) { & $bundledNode 'server.mjs' }
  else { Write-Host 'Install Node.js 20 or later, then run node server.mjs in this folder.'; Read-Host 'Press Enter to close' }
}
