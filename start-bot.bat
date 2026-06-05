@echo off
title AWB-OS WhatsApp Bot
cd /d "%~dp0backend"
echo ===========================================
echo   AWB-OS WhatsApp Business Bot
echo ===========================================
echo.
echo Admin: admin@awb-os.com / Admin@123456
echo Phone: 923281146929
echo.
echo When QR code appears in terminal:
echo   Open WhatsApp ^> 3 dots ^> Linked Devices ^> Link a Device
echo.
echo The pairing code (7 chars) also appears.
echo Use it if "Link with Phone Number" is available.
echo.
echo ===========================================
echo.
node local-start.js
pause
