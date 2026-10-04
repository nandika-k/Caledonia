$ErrorActionPreference = 'Stop'

# Build in a fresh temp directory so Azure CLI's Windows source packer never
# traverses the repository's potentially huge or partially installed node_modules.
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$contextRoot = Join-Path $env:TEMP ("caledonia-acr-context-" + [guid]::NewGuid().ToString('N'))

New-Item -ItemType Directory -Path $contextRoot | Out-Null

foreach ($name in @('Dockerfile', 'requirements.txt', 'app.py', 'service_classifier.py')) {
    Copy-Item -LiteralPath (Join-Path $repoRoot $name) -Destination $contextRoot
}
Copy-Item -LiteralPath (Join-Path $repoRoot 'deploy') -Destination $contextRoot -Recurse

$frontendSource = Join-Path $repoRoot 'frontend\enchanted-grove-ui'
$frontendTarget = Join-Path $contextRoot 'frontend\enchanted-grove-ui'
New-Item -ItemType Directory -Path $frontendTarget -Force | Out-Null

# Robocopy prunes these directories while copying, so it does not follow their
# contents or include local build output and environment files in the context.
& robocopy.exe $frontendSource $frontendTarget /E /XD node_modules .output .tanstack .wrangler dist coverage .turbo /XF .env .env.* | Out-Null
if ($LASTEXITCODE -ge 8) {
    throw "Could not copy the frontend into the clean build context (robocopy exit code $LASTEXITCODE)."
}

Write-Host "Clean Azure build context: $contextRoot"
Write-Host "Next run: az acr build --registry caledoniagrove20261004 --image caledonia:v1 `"$contextRoot`""
