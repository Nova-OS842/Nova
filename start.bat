@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js, then run this file again.
  pause
  exit /b 1
)
echo Starting Nova OS...
start "Nova OS" http://localhost:8080
node "%~dp0start-local.js"
endlocal
