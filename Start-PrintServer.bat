@echo off
title PetShop POS - Print Server
color 0B
echo ==================================================
echo.
echo       PetShop POS - Print Bridge Server
echo       (Local Print Server Port 3001)
echo.
echo ==================================================
echo.
echo Starting...
echo Keep this window open or minimized while using the POS.
echo.
cd print-server
node server.js
pause
