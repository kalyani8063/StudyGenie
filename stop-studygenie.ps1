param(
    [ValidateSet("all", "backend", "frontend")]
    [string]$Mode = "all"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$TmpDir = Join-Path $ProjectRoot ".tmp"
$BackendPort = 8000
$FrontendPort = 5173

function Stop-PortProcess([int]$Port, [string]$Name) {
    $connection = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($null -eq $connection) {
        Write-Host "$Name is not running on port $Port."
        return
    }

    $pid = [int]$connection.OwningProcess
    Stop-Process -Id $pid -Force -ErrorAction Stop
    Write-Host "Stopped $Name on port $Port (PID $pid)."
}

switch ($Mode) {
    "backend" { Stop-PortProcess -Port $BackendPort -Name "Backend" }
    "frontend" { Stop-PortProcess -Port $FrontendPort -Name "Frontend" }
    "all" {
        Stop-PortProcess -Port $BackendPort -Name "Backend"
        Stop-PortProcess -Port $FrontendPort -Name "Frontend"
    }
}
