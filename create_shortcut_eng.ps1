$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Start-PrintServer.lnk")
$Shortcut.TargetPath = "D:\Antigravity\งานbest\Start-PrintServer.bat"
$Shortcut.WorkingDirectory = "D:\Antigravity\งานbest"
$Shortcut.IconLocation = "shell32.dll,17"
$Shortcut.Save()
