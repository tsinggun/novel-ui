@echo off
chcp 65001 >nul
title 小说构建器
cd /d "%~dp0"
echo 正在启动小说构建器（便携版）...
node client\server.mjs
if errorlevel 1 (
  echo.
  echo 启动失败：请确认已安装 Node.js，且执行过 npm install / npm run client:build
  pause
)
