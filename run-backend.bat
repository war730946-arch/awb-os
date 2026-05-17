@echo off
title AWB-OS Backend (port 3456)
cd /d "%~dp0backend"
echo Starting AWB-OS Backend on http://localhost:3456
echo.
node src\index.js
pause
