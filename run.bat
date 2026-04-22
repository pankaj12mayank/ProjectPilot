@echo off
setlocal EnableExtensions
cd /d "%~dp0"
REM ProjectPilot: installs backend (incl. reportlab, python-docx, python-pptx) + frontend, then runs run.py

if not exist ".env" (
    echo [ProjectPilot] .env not found — copying .env.example to .env
    copy /Y ".env.example" ".env" >nul
    echo Edit .env and set ADMIN_EMAIL + ADMIN_PASSWORD, then run this batch again.
    pause
    exit /b 0
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

echo [ProjectPilot] Starting API + UI ^(python run.py^)...
echo   Docs http://127.0.0.1:8000/docs  -  UI http://127.0.0.1:5173  -  reports: outputs\reports\
python run.py
set "EC=%ERRORLEVEL%"
if not "%EC%"=="0" (
    echo run.py exited with code %EC%.
    pause
)
exit /b %EC%
