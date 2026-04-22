"""
Single entrypoint: installs backend deps if needed, starts API + Vite dev server.

Backend must import FastAPI, reporting stack (reportlab, python-docx, python-pptx),
and the app package. Usage (from repository root):  python run.py
"""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent
BACKEND = REPO / "backend"
FRONTEND = REPO / "frontend"


def _ensure_backend_deps() -> None:
    """Install backend stack if core packages are missing (full list in requirements.txt)."""
    try:
        import fastapi  # noqa: F401
        import uvicorn  # noqa: F401
        import reportlab  # noqa: F401
        import docx  # noqa: F401  # python-docx
        import pptx  # noqa: F401  # python-pptx
    except ImportError:
        print("Installing backend dependencies (first run or after requirements change)...")
        try:
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
                cwd=BACKEND,
                check=True,
            )
        except subprocess.CalledProcessError as exc:
            print("pip install failed. Try: cd backend && pip install -r requirements.txt")
            raise SystemExit(1) from exc


def _ensure_frontend_deps() -> None:
    if not (FRONTEND / "package.json").exists():
        return
    npm = shutil.which("npm")
    if not npm:
        print("npm not found; open backend only at http://127.0.0.1:8000/docs")
        return
    if not (FRONTEND / "node_modules").exists():
        print("Installing frontend dependencies (first run)...")
        subprocess.run([npm, "install"], cwd=FRONTEND, check=True)


def main() -> None:
    os.chdir(REPO)
    _ensure_backend_deps()
    _ensure_frontend_deps()

    env = os.environ.copy()
    paths = [str(BACKEND)]
    if env.get("PYTHONPATH"):
        paths.append(env["PYTHONPATH"])
    env["PYTHONPATH"] = os.pathsep.join(paths)

    chk = subprocess.run(
        [sys.executable, "-c", "from app.main import app"],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
    )
    if chk.returncode != 0:
        print("Backend import check failed:\n", chk.stderr or chk.stdout)
        print("Fix dependencies: cd backend && pip install -r requirements.txt")
        raise SystemExit(1)

    procs: list[subprocess.Popen] = []
    api = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
        ],
        cwd=BACKEND,
        env=env,
    )
    procs.append(api)
    time.sleep(1.5)
    if api.poll() is not None:
        print("Backend failed to start. Check logs in logs/app.log")
        print("Tip: ensure port 8000 is free, or run: cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000")
        sys.exit(1)

    npm = shutil.which("npm")
    if npm and (FRONTEND / "package.json").exists():
        ui = subprocess.Popen([npm, "run", "dev", "--", "--host", "127.0.0.1"], cwd=FRONTEND, env=env)
        procs.append(ui)

    print("ProjectPilot")
    print("  API docs:     http://127.0.0.1:8000/docs")
    print("  Health API:   /api/v1/projects/{id}/analytics/health")
    print("  Intelligence: /api/v1/projects/{id}/analytics/intelligence")
    print("  Reports:      POST /api/v1/projects/{id}/reports/generate")
    if len(procs) > 1:
        print("  Frontend:     http://127.0.0.1:5173")
    print("Press Ctrl+C to stop.\n")

    def _shutdown(*_: object) -> None:
        for p in procs:
            if p.poll() is None:
                p.terminate()
        for p in procs:
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    try:
        while True:
            time.sleep(0.5)
            if api.poll() is not None:
                print("Backend process exited.")
                break
    except KeyboardInterrupt:
        _shutdown()


if __name__ == "__main__":
    main()
