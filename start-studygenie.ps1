param(
    [ValidateSet("all", "backend", "frontend")]
    [string]$Mode = "all",
    [switch]$Restart
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$TmpDir = Join-Path $ProjectRoot ".tmp"
$BackendPort = 8000
$FrontendPort = 5173
$BackendPidFile = Join-Path $TmpDir "studygenie-backend.pid"
$FrontendPidFile = Join-Path $TmpDir "studygenie-frontend.pid"
$BackendLog = Join-Path $TmpDir "studygenie-backend.log"
$BackendErrLog = Join-Path $TmpDir "studygenie-backend.err.log"
$FrontendLog = Join-Path $TmpDir "studygenie-frontend.log"
$FrontendErrLog = Join-Path $TmpDir "studygenie-frontend.err.log"

function Ensure-TmpDir {
    if (-not (Test-Path $TmpDir)) {
        New-Item -ItemType Directory -Path $TmpDir | Out-Null
    }
}

function Get-ListeningProcessId([int]$Port) {
    $connection = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($null -eq $connection) {
        return $null
    }

    return [int]$connection.OwningProcess
}

function Stop-PortProcess([int]$Port) {
    $pid = Get-ListeningProcessId -Port $Port

    if ($null -ne $pid) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "Stopped process $pid on port $Port."
        }
        catch {
            Write-Warning "Could not stop process $pid on port ${Port}: $($_.Exception.Message)"
        }
    }
}

function Write-PidFile([string]$Path, [int]$ProcessIdValue) {
    Set-Content -Path $Path -Value $ProcessIdValue -Encoding ascii
}

function Test-PortReady([int]$Port, [int]$TimeoutSeconds = 20) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        if ($null -ne (Get-ListeningProcessId -Port $Port)) {
            return $true
        }

        Start-Sleep -Milliseconds 500
    }

    return $false
}

function Show-RecentLog([string]$Path) {
    if (Test-Path $Path) {
        $content = Get-Content $Path -Tail 30 -ErrorAction SilentlyContinue
        if ($content) {
            Write-Host ""
            Write-Host "Recent log from $Path"
            Write-Host "----------------------------------------"
            $content
            Write-Host "----------------------------------------"
        }
    }
}

function Start-Backend {
    $pythonExe = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
    if (-not (Test-Path $pythonExe)) {
        throw "Python virtualenv not found at .venv\Scripts\python.exe"
    }

    if ($Restart) {
        Stop-PortProcess -Port $BackendPort
    }

    $existingPid = Get-ListeningProcessId -Port $BackendPort
    if ($null -ne $existingPid) {
        Write-Host "Backend is already running on http://127.0.0.1:$BackendPort (PID $existingPid)"
        return
    }

    if (Test-Path $BackendLog) { Remove-Item -LiteralPath $BackendLog -Force -ErrorAction SilentlyContinue }
    if (Test-Path $BackendErrLog) { Remove-Item -LiteralPath $BackendErrLog -Force -ErrorAction SilentlyContinue }

    $process = Start-Process `
        -FilePath $pythonExe `
        -ArgumentList "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "$BackendPort" `
        -WorkingDirectory $ProjectRoot `
        -RedirectStandardOutput $BackendLog `
        -RedirectStandardError $BackendErrLog `
        -PassThru

    Write-PidFile -Path $BackendPidFile -ProcessIdValue $process.Id

    if (Test-PortReady -Port $BackendPort) {
        Write-Host "Backend started at http://127.0.0.1:$BackendPort (PID $($process.Id))"
    }
    else {
        Write-Warning "Backend did not open port $BackendPort."
        Show-RecentLog -Path $BackendLog
        Show-RecentLog -Path $BackendErrLog
    }
}

function Start-Frontend {
    $npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($null -eq $npmCmd) {
        throw "npm.cmd was not found on PATH."
    }

    if ($Restart) {
        Stop-PortProcess -Port $FrontendPort
    }

    $existingPid = Get-ListeningProcessId -Port $FrontendPort
    if ($null -ne $existingPid) {
        Write-Host "Frontend is already running on http://127.0.0.1:$FrontendPort (PID $existingPid)"
        return
    }

    if (Test-Path $FrontendLog) { Remove-Item -LiteralPath $FrontendLog -Force -ErrorAction SilentlyContinue }
    if (Test-Path $FrontendErrLog) { Remove-Item -LiteralPath $FrontendErrLog -Force -ErrorAction SilentlyContinue }

    $process = Start-Process `
        -FilePath $npmCmd.Source `
        -ArgumentList "--prefix", "frontend", "run", "dev", "--", "--host", "127.0.0.1", "--port", "$FrontendPort" `
        -WorkingDirectory $ProjectRoot `
        -RedirectStandardOutput $FrontendLog `
        -RedirectStandardError $FrontendErrLog `
        -PassThru

    Write-PidFile -Path $FrontendPidFile -ProcessIdValue $process.Id

    if (Test-PortReady -Port $FrontendPort) {
        Write-Host "Frontend started at http://127.0.0.1:$FrontendPort (PID $($process.Id))"
    }
    else {
        Write-Warning "Frontend did not open port $FrontendPort."
        Show-RecentLog -Path $FrontendLog
        Show-RecentLog -Path $FrontendErrLog
    }
}

Ensure-TmpDir

switch ($Mode) {
    "backend" { Start-Backend }
    "frontend" { Start-Frontend }
    "all" {
        Start-Backend
        Start-Frontend
        Write-Host ""
        Write-Host "StudyGenie URLs"
        Write-Host "Backend:  http://127.0.0.1:$BackendPort"
        Write-Host "Frontend: http://127.0.0.1:$FrontendPort"
    }
}
