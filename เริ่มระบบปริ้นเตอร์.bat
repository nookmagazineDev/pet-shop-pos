@echo off
title PetShop POS - Print Server
color 0B
echo ==================================================
echo.
echo       PetShop POS - Print Bridge Server
echo       (ระบบเชื่อมต่อเครื่องพิมพ์ใบเสร็จ)
echo.
echo ==================================================
echo.
echo กำลังเริ่มต้นระบบ...
echo หากต้องการปิดระบบ ให้กดกากบาทที่หน้าต่างนี้
echo.
cd print-server
node server.js
pause
