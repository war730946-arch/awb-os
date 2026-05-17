@echo off
title AWB-OS - Frontend
cd /d "%~dp0frontend"
echo Starting AWB-OS Frontend on port 3000...
echo.
npx next start -p 3000
pause
