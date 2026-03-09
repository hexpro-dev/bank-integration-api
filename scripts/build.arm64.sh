#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ARCH="$(uname -m)"
if [ "$ARCH" != "aarch64" ]; then
  echo "WARNING: This script targets linux/arm64 but host arch is '$ARCH'."
  echo "         For amd64 hosts, use scripts/build.sh instead."
  echo ""
fi

echo "=== Building bank-integration Docker images (linux/arm64) ==="

echo ""
echo "--- Building Database Package ---"
cd "$PROJECT_ROOT/database"
pnpm build:lib
echo "Database schema built successfully."
echo "Note: Migrations are applied automatically by the 'migrate' Docker Compose service."

echo ""
echo "--- Building API (Encore.ts) ---"
cd "$PROJECT_ROOT/api"
pnpm api:generate
encore build docker --config infra-config.json bank-integration-api:arm64 --arch arm64
echo "API image built: bank-integration-api:arm64 (linux/arm64)"

echo ""
echo "--- Building Observer ---"
cd "$PROJECT_ROOT"
docker build -f observer/Dockerfile -t bank-integration-observer:latest .
echo "Observer image built: bank-integration-observer:latest"

echo ""
echo "--- Building Frontend ---"
cd "$PROJECT_ROOT"
docker build -f front/Dockerfile -t bank-integration-front:latest .
echo "Frontend image built: bank-integration-front:latest"

echo ""
echo "=== All images built successfully ==="
echo ""
echo "Docker deployment (arm64):"
echo "  docker compose -f docker-compose.yml -f docker-compose.arm64.yml up -d"
echo "  (Migrations are applied automatically by the 'migrate' init service)"
echo ""
echo "Or use the auto-detect deploy script:"
echo "  ./scripts/deploy.sh --no-build"
