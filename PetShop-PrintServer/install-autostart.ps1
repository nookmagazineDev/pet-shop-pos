$CurrentDir = (Get-Item -Path ".\").FullName
$VbsPath = "$CurrentDir\print-server\RunHidden.vbs"
$BatPath = "$CurrentDir\print-server\RunHidden.bat"

# Create a bat file just for running Node silently without pausing
$BatContent = "cd /d ""$CurrentDir\print-server""`r`nnode server.js"
Set-Content -Path $BatPath -Value $BatContent -Encoding UTF8

# Create the VBS script to run the BAT completely hidden (0)
$VbsContent = "Set WshShell = CreateObject(""WScript.Shell"")`r`nWshShell.Run chr(34) & ""$BatPath"" & chr(34), 0`r`nSet WshShell = Nothing"
Set-Content -Path $VbsPath -Value $VbsContent -Encoding UTF8

# Create shortcut in Windows Startup folder
$WshShell = New-Object -comObject WScript.Shell
$StartupFolder = [Environment]::GetFolderPath('Startup')
$Shortcut = $WshShell.CreateShortcut("$StartupFolder\PetShop-PrintServer-AutoStart.lnk")
$Shortcut.TargetPath = "$VbsPath"
$Shortcut.WorkingDirectory = "$CurrentDir\print-server"
$Shortcut.Save()
