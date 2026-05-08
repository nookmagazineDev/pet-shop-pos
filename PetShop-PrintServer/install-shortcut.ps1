$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$CurrentDir = (Get-Item -Path ".\").FullName
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Start-PrintServer.lnk")
$Shortcut.TargetPath = "$CurrentDir\Start-PrintServer.bat"
$Shortcut.WorkingDirectory = "$CurrentDir"
$Shortcut.IconLocation = "shell32.dll,17"
$Shortcut.Save()
