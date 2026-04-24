@echo off
title PetShop POS - Install Shortcut
color 0B
echo ==================================================
echo.
echo       PetShop POS - Print Bridge Server
echo.
echo ==================================================
echo.
echo Installing desktop shortcut...
powershell -ExecutionPolicy Bypass -File "%~dp0install-shortcut.ps1"
echo.
echo Done! You can now launch the server from the Desktop icon.
echo.
pause
