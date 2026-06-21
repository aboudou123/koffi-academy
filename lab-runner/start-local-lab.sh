#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${KOFFI_LAB_IMAGE:-koffi/local-dev-box:latest}"

echo "Checking Docker..."
docker version

echo "Building local lab image: ${IMAGE}"
docker build -t "${IMAGE}" "${ROOT}/lab-runner/images/dev-box"

echo "Starting Koffi local lab server..."
export KOFFI_LAB_IMAGE="${IMAGE}"
node "${ROOT}/server.js"
