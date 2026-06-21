$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$image = if ($env:KOFFI_LAB_IMAGE) { $env:KOFFI_LAB_IMAGE } else { "koffi/local-dev-box:latest" }

Write-Host "Checking Docker..."
docker version | Out-Host

Write-Host "Building local lab image: $image"
docker build -t $image "$root\lab-runner\images\dev-box"

Write-Host "Starting Koffi local lab server..."
$env:KOFFI_LAB_IMAGE = $image
node "$root\server.js"
