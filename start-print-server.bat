@echo off
title PetShop POS - Print Server
color 0B

echo ==================================================
echo   PetShop POS - Print Server
echo ==================================================
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: Node.js not found!
    echo.
    echo Please install Node.js first:
    echo   1. Open the "setup" folder
    echo   2. Run "install-nodejs.bat"
    echo   3. Restart your computer
    echo   4. Run this file again
    echo.
    pause
    exit /b 1
)

:: Install packages on first run
if not exist "%~dp0print-server\node_modules" (
    echo [First run] Installing packages...
    echo.
    cd /d "%~dp0print-server"
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: npm install failed.
        pause
        exit /b 1
    )
    echo.
    echo Packages installed!
    echo.
)

cd /d "%~dp0print-server"
echo Starting Print Server...
echo Do NOT close this window while in use.
echo.
node server.js
pause
