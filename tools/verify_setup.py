#!/usr/bin/env python3
"""
Post-clone sanity check: layout + backend import. Run from repo root:

  python tools/verify_setup.py

Exit 0 if OK, non-zero if something is missing or imports fail (use in CI or after git pull).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BACKEND = REPO / "backend"


def main() -> int:
    required = [
        "backend/requirements.txt",
        "backend/app/main.py",
        "frontend/package.json",
        "docker-compose.yml",
        ".env.example",
        "frontend/.env.example",
    ]
    missing = [p for p in required if not (REPO / p).exists()]
    if missing:
        print("verify_setup: missing paths (wrong directory or incomplete clone?):")
        for m in missing:
            print(f"  - {m}")
        return 1

    os.chdir(REPO)
    if str(BACKEND) not in sys.path:
        sys.path.insert(0, str(BACKEND))

    try:
        from app.main import app  # noqa: F401
    except Exception as exc:  # pragma: no cover — diagnostic only
        print("verify_setup: backend import failed (install deps: pip install -r backend/requirements.txt):", exc)
        return 1

    print("verify_setup: OK - repo layout and app.main import.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
