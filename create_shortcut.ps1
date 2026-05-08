$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\เปิดเซิร์ฟเวอร์ปริ้นใบเสร็จ.lnk")
$Shortcut.TargetPath = "d:\Antigravity\งานbest\เริ่มระบบปริ้นเตอร์.bat"
$Shortcut.IconLocation = "shell32.dll,17"
$Shortcut.Save()
