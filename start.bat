@echo off
title AWB-OS LAUNCHER
color 0A
echo ========================================
echo    AWB-OS v1.0.0
echo    STARTING SERVERS...
echo ========================================
echo.

:: Kill any old servers
taskkill /f /fi "WINDOWTITLE eq AWB-OS-Backend*" >nul 2>nul
taskkill /f /fi "WINDOWTITLE eq AWB-OS-Frontend*" >nul 2>nul
timeout /t 2 /nobreak >nul

:: Start Backend (port 3456)
echo [1/2] Starting Backend...
start "AWB-OS-Backend" cmd /c "title AWB-OS-Backend && cd /d %CD%\backend && node src\index.js && pause"

:: Wait
timeout /t 4 /nobreak >nul

:: Start Frontend (port 3000)
echo [2/2] Starting Frontend...
start "AWB-OS-Frontend" cmd /c "title AWB-OS-Frontend && cd /d %CD%\frontend && npx next start -p 3000 && pause"

:: Wait for frontend
timeout /t 6 /nobreak >nul

echo.
echo ========================================
echo    ✅ AWB-OS CHAL RAHA HAI!
echo ========================================
echo.
echo    OPEN:    http://localhost:3000
echo    BACKEND: http://localhost:3456
echo.
echo    Login:   test@demo.com
echo    Pass:    demo123
echo.
echo    Dono CMD windows KHULI rehne dena.
echo    Band karne se server band ho jayega.
echo.
echo    Press any key to close this window...
pause >nul
