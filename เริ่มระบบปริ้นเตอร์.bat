@echo off
chcp 65001 >nul
title PetShop POS - Print Server
color 0B
echo ==================================================
echo.
echo   PetShop POS - Print Server
echo.
echo ==================================================
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] ไม่พบ Node.js ในเครื่อง!
    echo.
    echo กรุณาติดตั้ง Node.js ก่อน:
    echo   1. เปิด browser ไปที่  https://nodejs.org
    echo   2. กดดาวน์โหลด  "LTS" (แนะนำ)
    echo   3. ติดตั้งแล้ว Restart คอมพิวเตอร์
    echo   4. เปิดไฟล์นี้ใหม่อีกครั้ง
    echo.
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "%~dp0print-server\node_modules" (
    echo [ครั้งแรก] กำลังติดตั้ง package...
    echo.
    cd /d "%~dp0print-server"
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] npm install ไม่สำเร็จ
        pause
        exit /b 1
    )
    echo.
    echo ติดตั้งเสร็จแล้ว!
    echo.
)

cd /d "%~dp0print-server"
echo กำลังเริ่ม Print Server...
echo ห้ามปิดหน้าต่างนี้ระหว่างใช้งาน
echo.
node server.js
pause
