@echo off
chcp 65001 >nul
title ติดตั้ง Node.js
color 0B

echo ==================================================
echo   ติดตั้ง Node.js สำหรับ PetShop POS Print Server
echo ==================================================
echo.

:: Check if already installed
node --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('node --version') do set NODEVER=%%v
    echo Node.js ติดตั้งแล้ว: %NODEVER%
    echo.
    echo ไม่ต้องติดตั้งซ้ำ
    echo.
    pause
    exit /b 0
)

echo กำลังติดตั้ง Node.js...
echo.

:: Run MSI installer (silent install)
set INSTALLER=%~dp0node-v24.15.0-x64.msi
if not exist "%INSTALLER%" (
    color 0C
    echo ไม่พบไฟล์ %INSTALLER%
    echo กรุณาดาวน์โหลด Node.js ใหม่จาก https://nodejs.org
    pause
    exit /b 1
)

msiexec /i "%INSTALLER%" /qb ADDLOCAL=ALL
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ติดตั้งไม่สำเร็จ กรุณาลองดับเบิลคลิก node-v24.15.0-x64.msi เอง
    pause
    exit /b 1
)

echo.
color 0A
echo ===================================
echo   ติดตั้ง Node.js เสร็จเรียบร้อย!
echo ===================================
echo.
echo กรุณา RESTART คอมพิวเตอร์ก่อนใช้งาน
echo แล้วเปิด "เริ่มระบบปริ้นเตอร์.bat" ได้เลย
echo.
pause
