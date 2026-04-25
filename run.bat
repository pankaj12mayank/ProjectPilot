@echo off
setlocal EnableExtensions
cd /d "%~dp0"
REM ProjectPilot: ensure .env then start API + UI via Docker Compose (one command).

if not exist ".env" (
    if exist ".env.example" (
        echo [ProjectPilot] .env not found - copying .env.example to .env
        copy /Y ".env.example" ".env" >nul
        echo [ProjectPilot] Edit .env for production: JWT_SECRET_KEY, ADMIN_EMAIL, ADMIN_PASSWORD. Continuing...
    ) else (
        echo [ProjectPilot] ERROR: .env.example missing - cannot bootstrap .env
        pause
        exit /b 1
    )
)

where docker >nul 2>&1
if errorlevel 1 (
    echo [ProjectPilot] Docker not found on PATH. Install Docker Desktop, then try again.
    echo Without Docker, use manual start - see README section 4 (Uvicorn + Vite^).
    pause
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo [ProjectPilot] Docker is installed, but the engine is not running.
    echo   Open Docker Desktop and wait until the engine is running, then run this again.
    echo   Or see README section 4 to run the API and UI without Docker.
    echo.
    pause
    exit /b 1
)

echo [ProjectPilot] Starting with Docker Compose...
echo   Docs: http://127.0.0.1:8000/docs
echo   UI:   http://127.0.0.1:5173
echo   Press Ctrl+C to stop.
echo.
docker compose up --build
set "EC=%ERRORLEVEL%"
if not "%EC%"=="0" (
    echo docker compose exited with code %EC%.
    pause
)
exit /b %EC%
