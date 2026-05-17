Set WShell = CreateObject("WScript.Shell")
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

' Start Backend on 3456
WShell.Run "cmd.exe /k cd /d """ & strPath & "\backend"" && node src\index.js", 1, False
WScript.Sleep 3000

' Start Frontend on 3000
WShell.Run "cmd.exe /k cd /d """ & strPath & "\frontend"" && npx next start -p 3000", 1, False
WScript.Sleep 5000

' Open browser
WShell.Run "http://localhost:3000", 1, False
