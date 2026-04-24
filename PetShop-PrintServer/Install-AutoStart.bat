@echo off
title PetShop POS - Install Auto Start
color 0A
echo ==================================================
echo.
echo       PetShop POS - Print Bridge Server
echo.
echo ==================================================
echo.
echo Installing background auto-start...
powershell -ExecutionPolicy Bypass -File "%~dp0install-autostart.ps1"
echo.
echo Done! The print server will now start automatically IN THE BACKGROUND
echo every time you turn on this PC. You won't see a black window anymore.
echo.
pause
