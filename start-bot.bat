@echo off
title AWB-OS WhatsApp Bot
echo ====================================
echo   AWB-OS WhatsApp Bot Launcher
echo ====================================
echo.

cd /d "%~dp0backend"

set API_URL=https://backend-ddjdpd94x-war730946-9176s-projects.vercel.app

echo Starting WhatsApp bot...
echo API URL: %API_URL%
echo.
echo Press Ctrl+C to stop the bot
echo.

node ..\bot-standalone.js

pause
