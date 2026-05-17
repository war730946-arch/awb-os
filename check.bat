@echo off
title AWB-OS Checker
color 0E
echo ========================================
echo    AWB-OS Status Check
echo ========================================
echo.

:: Check port 3000 (Frontend)
echo [*] Checking Frontend (port 3000)...
curl -s -o nul -w "%%{http_code}" http://localhost:3000 2>&1 | find "200" >nul
if %errorlevel% equ 0 (
    echo [OK] Frontend: http://localhost:3000 - CHAL RAHA HAI
) else (
    echo [FAIL] Frontend: http://localhost:3000 - NAHI CHAL RAHA
)

:: Check port 3002 (Backend)
echo [*] Checking Backend (port 3002)...
curl -s http://localhost:3002/api/health 2>&1 | find "ok" >nul
if %errorlevel% equ 0 (
    echo [OK] Backend: http://localhost:3002 - CHAL RAHA HAI
) else (
    echo [FAIL] Backend: http://localhost:3002 - NAHI CHAL RAHA
)

:: Check port 3001 (old server)
echo [*] Checking Port 3001 (old server)...
curl -s -o nul -w "%%{http_code}" http://localhost:3001 2>&1 | find "200" >nul
if %errorlevel% equ 0 (
    echo [WARN] Port 3001 pe koi aur server chal raha hai - isko ignore karein
) else (
    echo [OK] Port 3001 free hai
)

echo.
echo ========================================
echo    AGAR FRONTEND NAHI CHAL RAHA:
echo    start.bat dubara run karein
echo.
echo    AGAR BACKEND NAHI CHAL RAHA:
echo    cd backend ^&^& npm start
echo ========================================
pause
