#!/usr/bin/env bash
# ProjectPilot — Unix/macOS: repo-root deps + dev server (parity with run.bat).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PY=python3
if ! command -v python3 >/dev/null 2>&1; then
  PY=python
fi

if [[ ! -f .env ]] && [[ -f .env.example ]]; then
  cp .env.example .env
  echo "[ProjectPilot] Created .env from .env.example — edit JWT_SECRET_KEY and ADMIN_* for production. Continuing..."
elif [[ ! -f .env ]]; then
  echo "[ProjectPilot] ERROR: no .env and no .env.example — cannot bootstrap."
  exit 1
fi

echo "[ProjectPilot] Updating backend (pip)..."
"$PY" -m pip install -q --upgrade pip
"$PY" -m pip install -r backend/requirements.txt

echo "[ProjectPilot] Updating frontend (npm)..."
( cd frontend && npm install )

if [[ ! -f frontend/.env ]] && [[ -f frontend/.env.example ]]; then
  cp frontend/.env.example frontend/.env
  echo "[ProjectPilot] Created frontend/.env from frontend/.env.example"
fi

echo "[ProjectPilot] Starting API + UI ($PY tools/dev_server.py)..."
echo "  Docs http://127.0.0.1:8000/docs  —  UI http://127.0.0.1:5173"
exec "$PY" tools/dev_server.py
