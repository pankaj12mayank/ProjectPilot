#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [[ ! -f .env ]] && [[ -f .env.example ]]; then
  cp .env.example .env
elif [[ ! -f .env ]]; then
  echo "[ProjectPilot] ERROR: no .env and no .env.example"
  exit 1
fi

echo "[ProjectPilot] Starting backend + frontend..."
echo

echo "Starting backend (uvicorn)..."
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
cd "$ROOT"

sleep 3

echo "Starting frontend (vite)..."
cd frontend
npm run dev -- --host 127.0.0.1 &
FRONTEND_PID=$!
cd "$ROOT"

echo
echo "  API docs: http://127.0.0.1:8000/docs"
echo "  UI:       http://127.0.0.1:5173"
echo "  Press Ctrl+C to stop."
echo

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
