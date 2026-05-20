@echo off
title Install Node.js
color 0B

echo ==================================================
echo   PetShop POS - Node.js Installer
echo ==================================================
echo.

:: Check if already installed
node --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('node --version') do set NODEVER=%%v
    echo Node.js already installed: %NODEVER%
    echo.
    echo Nothing to do.
    echo.
    pause
    exit /b 0
)

echo Installing Node.js ...
echo.

set INSTALLER=%~dp0node-v24.15.0-x64.msi
if not exist "%INSTALLER%" (
    color 0C
    echo ERROR: File not found: %INSTALLER%
    echo Please check that node-v24.15.0-x64.msi is in the same folder.
    pause
    exit /b 1
)

msiexec /i "%INSTALLER%" /qb ADDLOCAL=ALL
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ERROR: Installation failed.
    echo Try double-clicking node-v24.15.0-x64.msi manually.
    pause
    exit /b 1
)

color 0A
echo.
echo ==================================================
echo   Node.js installed successfully!
echo ==================================================
echo.
echo IMPORTANT: Please RESTART your computer before use.
echo After restart, open "start-print-server.bat"
echo.
pause
