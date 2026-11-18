@echo off
cd /d "%~dp0"
set "NODE_EXE="
if exist "C:\nvm4w\nodejs\node.exe" set "NODE_EXE=C:\nvm4w\nodejs\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%i"
if not defined NODE_EXE (
  echo Node.js not found. Install Node.js 20+ from https://nodejs.org and retry.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo First run: building the UI, please wait...
  "%NODE_EXE%" node_modules\vite\bin\vite.js build
  if not exist "dist\index.html" pause & exit /b 1
)
"%NODE_EXE%" client\server.mjs
if errorlevel 1 (
  echo.
  echo Startup failed. See messages above.
  pause
)
