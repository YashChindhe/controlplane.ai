# ControlPlane.ai - Local Dev Environment Runner
# This script spins up the Docker Compose stack (Databases & Services) and runs the Gateway & Tri-Guard locally.

$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " Starting ControlPlane.ai (Tri-Guard) Stack  " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Check for .env file
if (-not (Test-Path ".env")) {
    Write-Host "[*] Creating .env from .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item .env.example .env
    } else {
        Write-Warning "Could not find .env.example. Creating a blank .env file."
        New-Item -Path .env -ItemType File | Out-Null
    }
}

# 2. Check for node_modules and install dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "[*] Installing Node.js root and workspace dependencies..." -ForegroundColor Yellow
    npm install
}

# 3. Spin up Docker Compose dependencies (Postgres, Redis, Redpanda, policy-service, audit-service)
Write-Host "[*] Spinning up Docker Compose dependencies..." -ForegroundColor Yellow
docker-compose up -d --build

Write-Host "[*] Waiting 10 seconds for databases and services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 4. Start Tri-Guard Python FastAPI engine in a new window
Write-Host "[*] Launching Tri-Guard Python service (Port 8000)..." -ForegroundColor Yellow
$TriGuardPath = Join-Path (Get-Location) "apps/tri-guard"
if (Test-Path "$TriGuardPath/requirements.txt") {
    # Try using virtualenv if it exists, otherwise use global python
    $PythonCmd = "python -m pip install -r requirements.txt; uvicorn main:app --host 0.0.0.0 --port 8000"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$TriGuardPath'; $PythonCmd"
} else {
    Write-Error "Could not find apps/tri-guard requirements.txt!"
}

# 5. Done!
Write-Host "=============================================" -ForegroundColor Green
Write-Host " ControlPlane.ai services started!           " -ForegroundColor Green
Write-Host " - Gateway (Docker): http://localhost:3000   " -ForegroundColor Green
Write-Host " - Dashboard (Docker): http://localhost:3001 " -ForegroundColor Green
Write-Host " - Tri-Guard (Local): http://localhost:8000  " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

