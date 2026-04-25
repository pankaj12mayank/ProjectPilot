@echo off
setlocal EnableExtensions
cd /d "%~dp0"
REM ProjectPilot: installs backend (incl. reportlab, python-docx, python-pptx) + frontend, then starts API + Vite via tools\dev_server.py

if not exist ".env" (
    if exist ".env.example" (
        echo [ProjectPilot] .env not found — copying .env.example to .env
        copy /Y ".env.example" ".env" >nul
        echo [ProjectPilot] Edit .env for production ^(JWT_SECRET_KEY, ADMIN_*^). Continuing startup...
    ) else (
        echo [ProjectPilot] ERROR: .env.example missing — cannot bootstrap .env
        pause
        exit /b 1
    )
)

echo [ProjectPilot] Updating backend ^(pip^)...
python -m pip install -q --upgrade pip
python -m pip install -r "backend\requirements.txt"
if errorlevel 1 (
    echo pip failed.
    pause
    exit /b 1
)

echo [ProjectPilot] Updating frontend ^(npm^)...
pushd "frontend"
call npm install
if errorlevel 1 (
    echo npm failed.
    popd
    pause
    exit /b 1
)
popd

if not exist "frontend\.env" (
    if exist "frontend\.env.example" (
        copy /Y "frontend\.env.example" "frontend\.env" >nul
        echo [ProjectPilot] Created frontend\.env from frontend\.env.example
    )
)

echo [ProjectPilot] Starting API + UI ^(python tools\dev_server.py^)...
echo   Docs http://127.0.0.1:8000/docs  -  UI http://127.0.0.1:5173
python tools\dev_server.py
set "EC=%ERRORLEVEL%"
if not "%EC%"=="0" (
    echo dev_server exited with code %EC%.
    pause
)
exit /b %EC%
