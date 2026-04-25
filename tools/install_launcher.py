"""
Windows GUI launcher for ProjectPilot setup.
Build one-file EXE from repo root:  build-installer-exe.bat

Place next to the EXE (recommended):
  - SETUP_NOTES.txt

Double-clicking the EXE shows a short summary, then opens a NEW console that runs
the same program with --run-setup (venv, pip, npm, .env copy) — no separate PowerShell installer.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

if sys.platform != "win32":
    print("This launcher is for Windows only.")
    sys.exit(1)

import ctypes  # noqa: E402

MB_OK = 0x00000000
MB_OKCANCEL = 0x00000001
MB_ICONINFORMATION = 0x00000040
MB_ICONERROR = 0x00000010
IDOK = 1
CREATE_NEW_CONSOLE = 0x00000010


def bundle_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def ask_ok_cancel(title: str, text: str) -> int:
    return int(ctypes.windll.user32.MessageBoxW(None, text, title, MB_OKCANCEL | MB_ICONINFORMATION))


def show_ok(title: str, text: str, *, error: bool = False) -> None:
    flags = MB_OK | (MB_ICONERROR if error else MB_ICONINFORMATION)
    ctypes.windll.user32.MessageBoxW(None, text, title, flags)


def _attach_console_if_frozen() -> None:
    """Windowed PyInstaller EXE has no console; CREATE_NEW_CONSOLE alone may not show output."""
    if not getattr(sys, "frozen", False):
        return
    k32 = ctypes.windll.kernel32
    if k32.GetConsoleWindow() == 0:
        k32.AllocConsole()
    sys.stdout = open("CONOUT$", "w", encoding="utf-8", errors="replace")
    sys.stderr = open("CONOUT$", "w", encoding="utf-8", errors="replace")
    try:
        sys.stdin = open("CONIN$", "r", encoding="utf-8", errors="replace")
    except OSError:
        pass


def run_cli_setup() -> int:
    """Console setup: venv, pip install, npm install, .env from example (same steps as former install-windows.ps1)."""
    _attach_console_if_frozen()
    root = bundle_dir()
    os.chdir(root)

    py_exe = shutil.which("python") or shutil.which("py")
    if not py_exe:
        print("ERROR: Python 3.11+ not found on PATH.", file=sys.stderr)
        print("Install from https://www.python.org/downloads/ and re-run.", file=sys.stderr)
        input("Press Enter to close…")
        return 1

    npm = shutil.which("npm")
    if not npm:
        print("ERROR: Node.js / npm not found on PATH.", file=sys.stderr)
        print("Install LTS from https://nodejs.org/ and re-run.", file=sys.stderr)
        input("Press Enter to close…")
        return 1

    print("== ProjectPilot Windows setup ==", flush=True)
    subprocess.run([py_exe, "--version"], check=False)

    venv = root / ".venv"
    if not venv.is_dir():
        print("Creating virtual environment at .venv ...", flush=True)
        r = subprocess.run([py_exe, "-m", "venv", str(venv)])
        if r.returncode != 0:
            input("Press Enter to close…")
            return r.returncode

    pip = venv / "Scripts" / "pip.exe"
    if not pip.is_file():
        print(f"ERROR: Expected pip at {pip}", file=sys.stderr)
        input("Press Enter to close…")
        return 1

    print("Upgrading pip ...", flush=True)
    subprocess.run([str(pip), "install", "--upgrade", "pip"], check=False)

    req = root / "backend" / "requirements.txt"
    if not req.is_file():
        print(f"ERROR: Missing {req}", file=sys.stderr)
        input("Press Enter to close…")
        return 1

    print("Installing Python dependencies ...", flush=True)
    r = subprocess.run([str(pip), "install", "-r", str(req)])
    if r.returncode != 0:
        input("Press Enter to close…")
        return r.returncode

    fe = root / "frontend"
    if not fe.is_dir():
        print(f"ERROR: Missing {fe}", file=sys.stderr)
        input("Press Enter to close…")
        return 1

    print("Installing frontend dependencies (npm install) ...", flush=True)
    r = subprocess.run([npm, "install"], cwd=str(fe))
    if r.returncode != 0:
        input("Press Enter to close…")
        return r.returncode

    fe_env = root / "frontend" / ".env"
    fe_ex = root / "frontend" / ".env.example"
    if not fe_env.is_file() and fe_ex.is_file():
        shutil.copy(fe_ex, fe_env)
        print("Created frontend/.env from frontend/.env.example (default VITE_API_URL for local dev).", flush=True)

    env_example = root / ".env.example"
    env_file = root / ".env"
    if not env_file.is_file() and env_example.is_file():
        shutil.copy(env_example, env_file)
        print(
            "Created .env from .env.example — edit JWT_SECRET_KEY and ADMIN_* before production.",
            flush=True,
        )

    print("", flush=True)
    print("Done. Next steps:", flush=True)
    print("  1. Edit .env (JWT_SECRET_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, CORS_ORIGINS, DATABASE_URL if needed)")
    print(r"  2. Start API + UI:  .\.venv\Scripts\python.exe tools\dev_server.py")
    print(r"     Or double-click run.bat (uses your PATH Python; installs deps then runs dev_server).")
    print("  3. Sign in with the admin from .env; add users under Admin → Users.")
    input("\nPress Enter to close…")
    return 0


def main_gui() -> int:
    root = bundle_dir()
    notes = root / "SETUP_NOTES.txt"

    intro = (
        "ProjectPilot — setup launcher\n\n"
        "IMPORTANT (summary):\n"
        "• This is NOT a full installer — it does NOT install Python or Node.\n"
        "• Python and Node must already be on your PATH.\n"
        "• pip/npm need network; disk, permissions, or antivirus can still fail.\n\n"
        f"Full details:  {notes.name if notes.exists() else '(missing — copy from repo)'}\n\n"
        "OK = open a NEW window and run setup\n"
        "Cancel = exit"
    )

    if ask_ok_cancel("ProjectPilot Setup", intro) != IDOK:
        return 0

    if getattr(sys, "frozen", False):
        cmd = [str(Path(sys.executable).resolve()), "--run-setup"]
    else:
        cmd = [sys.executable, str(Path(__file__).resolve()), "--run-setup"]

    try:
        subprocess.Popen(
            cmd,
            cwd=str(root),
            creationflags=CREATE_NEW_CONSOLE,
        )
    except OSError as e:
        show_ok("ProjectPilot Setup", f"Could not start setup console:\n{e}", error=True)
        return 1

    show_ok(
        "ProjectPilot Setup",
        "A new console window is running setup.\n\n"
        "Watch that window for progress and errors.\n"
        "When it finishes, edit .env as described in SETUP_NOTES.txt.",
    )
    return 0


def main() -> int:
    if "--run-setup" in sys.argv:
        return run_cli_setup()
    return main_gui()


if __name__ == "__main__":
    raise SystemExit(main())
