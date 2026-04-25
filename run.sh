#!/usr/bin/env bash
# ProjectPilot — ensure .env, then API + UI via Docker Compose (parity with run.bat).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [[ ! -f .env ]] && [[ -f .env.example ]]; then
  cp .env.example .env
  echo "[ProjectPilot] Created .env from .env.example - edit JWT_SECRET_KEY and ADMIN_* for production. Continuing..."
elif [[ ! -f .env ]]; then
  echo "[ProjectPilot] ERROR: no .env and no .env.example - cannot bootstrap."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[ProjectPilot] docker not found. Install Docker, then try again."
  echo "Without Docker, use README section 4 (Uvicorn + Vite)."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "[ProjectPilot] Docker is installed, but the engine is not running."
  echo "Start Docker Desktop and try again, or use README section 4 without Docker."
  exit 1
fi

echo "[ProjectPilot] Starting with Docker Compose..."
echo "  Docs: http://127.0.0.1:8000/docs"
echo "  UI:   http://127.0.0.1:5173"
echo "  Press Ctrl+C to stop."
echo
exec docker compose up --build
