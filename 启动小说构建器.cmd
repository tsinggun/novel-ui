@echo off
cd /d "%~dp0"
set "NODE_EXE=node"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Please install Node.js 20+ and retry.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo First run: building the UI, please wait...
  call npm run client:build
)
node client\server.mjs
if errorlevel 1 (
  echo.
  echo Startup failed. See the messages above.
  pause
)
