@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist ".env" (
    if exist ".env.example" (
        copy /Y ".env.example" ".env" >nul
    ) else (
        echo [ProjectPilot] ERROR: .env.example missing
        pause
        exit /b 1
    )
)

echo [ProjectPilot] Starting backend + frontend...
echo.
echo Starting backend (uvicorn)...
start "ProjectPilot-Backend" cmd /c "cd /d backend && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

timeout /t 3 /nobreak >nul

echo Starting frontend (vite)...
start "ProjectPilot-Frontend" cmd /c "cd /d frontend && npm run dev -- --host 127.0.0.1"

echo.
echo   API docs: http://127.0.0.1:8000/docs
echo   UI:       http://127.0.0.1:5173
echo.
echo Close the backend/frontend windows or press Ctrl+C to stop.
echo.
pause
