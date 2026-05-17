# AWB-OS One-Click Start (PowerShell)
# Isko "Run with PowerShell" karein ya PowerShell mein paste karein

$root = "C:\Users\CH\Desktop\ai whatspp bot\awb-os"

Write-Host "========================================" -ForegroundColor Green
Write-Host "   AWB-OS Starting..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Kill old servers
Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in @(3000,3456) -and $_.State -eq "Listen" } | ForEach-Object { 
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue 
}
Start-Sleep 2

# Start Backend
$backendDir = Join-Path $root "backend"
$psi1 = New-Object System.Diagnostics.ProcessStartInfo
$psi1.FileName = "cmd.exe"
$psi1.Arguments = "/c node src\index.js"
$psi1.WorkingDirectory = $backendDir
$psi1.UseShellExecute = $true
$psi1.WindowStyle = "Normal"
[System.Diagnostics.Process]::Start($psi1) | Out-Null
Write-Host "[OK] Backend starting on http://localhost:3456" -ForegroundColor Cyan

Start-Sleep 3

# Start Frontend
$frontendDir = Join-Path $root "frontend"
$psi2 = New-Object System.Diagnostics.ProcessStartInfo
$psi2.FileName = "cmd.exe"
$psi2.Arguments = "/c npx next start -p 3000"
$psi2.WorkingDirectory = $frontendDir
$psi2.UseShellExecute = $true
$psi2.WindowStyle = "Normal"
[System.Diagnostics.Process]::Start($psi2) | Out-Null
Write-Host "[OK] Frontend starting on http://localhost:3000" -ForegroundColor Cyan

Start-Sleep 5

# Open browser
Start-Process "http://localhost:3000"

Write-Host "========================================" -ForegroundColor Green
Write-Host "   ✅ AWB-OS CHAL RAHA HAI!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host " OPEN: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host " LOGIN: final@demo.com / demo123" -ForegroundColor White
Write-Host " YA Register karein naya account" -ForegroundColor White
Write-Host ""
