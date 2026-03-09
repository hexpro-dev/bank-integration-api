#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

NO_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --no-build) NO_BUILD=1 ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: $0 [--no-build]"
      exit 1
      ;;
  esac
done

ARCH="$(uname -m)"

case "$ARCH" in
  x86_64)
    COMPOSE_OVERRIDE="docker-compose.amd64.yml"
    BUILD_SCRIPT="$SCRIPT_DIR/build.sh"
    ;;
  aarch64)
    COMPOSE_OVERRIDE="docker-compose.arm64.yml"
    BUILD_SCRIPT="$SCRIPT_DIR/build.arm64.sh"
    ;;
  *)
    echo "ERROR: Unsupported architecture '$ARCH'. Supported: x86_64, aarch64."
    exit 1
    ;;
esac

echo "=== Deploying bank-integration ($ARCH) ==="
echo ""

if [ "$NO_BUILD" -eq 0 ]; then
  echo "--- Building images ---"
  bash "$BUILD_SCRIPT"
  echo ""
else
  echo "Skipping build (--no-build)."
  echo ""
fi

echo "--- Starting services ---"
cd "$PROJECT_ROOT"
docker compose -f docker-compose.yml -f "$COMPOSE_OVERRIDE" up -d

echo ""
echo "=== Deployment complete ==="
echo ""
echo "View logs:  docker compose -f docker-compose.yml -f $COMPOSE_OVERRIDE logs -f"
echo "Stop:       docker compose -f docker-compose.yml -f $COMPOSE_OVERRIDE down"
