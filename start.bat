@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js, then run this file again.
  pause
  exit /b 1
)
set "PORT="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$p=8080; while($p -le 8099){ try{$l=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$p);$l.Start();$l.Stop();Write-Output $p;break}catch{$p++} }"`) do if not defined PORT set "PORT=%%P"
if not defined PORT (
  echo Could not find a free Nova port from 8080-8099.
  pause
  exit /b 1
)
echo Starting Nova OS on port %PORT%...
start "Nova OS" "http://localhost:%PORT%/"
set "PORT=%PORT%"
node "%~dp0start-local.js"
endlocal
