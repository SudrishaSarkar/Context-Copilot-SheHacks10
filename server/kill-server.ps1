# Kill server on port 8787
$port = 8787
$processes = netstat -ano | Select-String ":$port.*LISTENING" | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -Unique

if ($processes) {
    Write-Host "Found process(es) on port ${port}: $($processes -join ', ')"
    $processes | ForEach-Object {
        Write-Host "Killing process $_..."
        taskkill /F /PID $_ 2>&1 | Out-Null
    }
    Write-Host "Server killed successfully!" -ForegroundColor Green
} else {
    Write-Host "No server running on port ${port}" -ForegroundColor Yellow
}
