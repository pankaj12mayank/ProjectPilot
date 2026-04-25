@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo == Build ProjectPilotSetup.exe ==
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo ERROR: python not on PATH. Install Python 3.11+ then run this batch file.
  exit /b 1
)

python -m pip install --upgrade pip pyinstaller
if errorlevel 1 (
  echo ERROR: pip could not install pyinstaller.
  exit /b 1
)

if not exist "tools\install_launcher.py" (
  echo ERROR: tools\install_launcher.py not found.
  exit /b 1
)

pyinstaller --noconfirm --clean --onefile --windowed --name ProjectPilotSetup "tools\install_launcher.py"
if errorlevel 1 (
  echo ERROR: PyInstaller failed.
  exit /b 1
)

copy /Y "SETUP_NOTES.txt" "dist\SETUP_NOTES.txt" >nul

echo.
echo OK: dist\ProjectPilotSetup.exe
echo     dist\SETUP_NOTES.txt
echo.
echo Zip the EXE + SETUP_NOTES with your full repo tree ^(backend, frontend, .env.example, run.bat^) for others.
endlocal
