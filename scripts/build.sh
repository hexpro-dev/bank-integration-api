#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Building bank-integration Docker images ==="

echo ""
echo "--- Building Database Package ---"
cd "$PROJECT_ROOT/database"
pnpm build:lib
echo "Database schema built successfully."
echo "Note: Migrations are applied automatically by the 'migrate' Docker Compose service."

echo ""
echo "--- Building API (Encore.ts) ---"
cd "$PROJECT_ROOT/api"
encore build docker --config infra-config.json bank-integration-api:latest
echo "API image built: bank-integration-api:latest"

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
echo "Local development:"
echo "  1. cp .env.example .env && edit .env with your secrets"
echo "  2. docker compose up postgres -d"
echo "  3. export \$(grep -v '^#' .env | xargs)"
echo "  4. cd database && pnpm db:migrate"
echo "  5. cd api && encore run --config infra-config.json"
echo ""
echo "Docker deployment:"
echo "  docker compose up"
echo "  (Migrations are applied automatically by the 'migrate' init service)"
