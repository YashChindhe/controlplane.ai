# ControlPlane.ai — Local Dev Environment Runner
# Strategy:
#   - Docker: Postgres, Redis, Redpanda, policy-service, audit-service
#   - Local:  Gateway (Node.js), Dashboard (Next.js), Tri-Guard (Python/FastAPI)
# This gives hot-reload on all app-level services without Docker rebuilds.

$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Starting ControlPlane.ai Dev Stack         " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$RootPath = (Get-Location).Path

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
} else {
    Write-Host "[*] Node.js dependencies already installed." -ForegroundColor Green
}

# 3. Spin up ONLY infrastructure + Python services in Docker
#    (Postgres, Redis, Redpanda, policy-service, audit-service)
#    Gateway and Dashboard run locally for easy debugging.
Write-Host "[*] Spinning up infrastructure (Postgres, Redis, Redpanda, policy-service, audit-service)..." -ForegroundColor Yellow
docker-compose up -d --build postgres redis redpanda policy-service audit-service

Write-Host "[*] Waiting 20 seconds for infrastructure to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

# 4. Start Tri-Guard Python FastAPI engine in a new window
#    CRITICAL: Must set CWD to apps/tri-guard AND add it to PYTHONPATH
#    so bare imports (from guards.performance import ...) resolve correctly.
Write-Host "[*] Launching Tri-Guard Python service (Port 8000)..." -ForegroundColor Yellow
$TriGuardPath = Join-Path $RootPath "apps\tri-guard"
if (Test-Path "$TriGuardPath\requirements.txt") {
    $PythonCmd = @"
Set-Location '$TriGuardPath'
`$env:PYTHONPATH = '$TriGuardPath'
Write-Host 'Tri-Guard: Installing dependencies...' -ForegroundColor Yellow
python -m pip install -r requirements.txt --quiet
Write-Host 'Tri-Guard: Starting FastAPI on port 8000...' -ForegroundColor Cyan
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"@
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $PythonCmd -WindowStyle Normal
} else {
    Write-Error "Could not find apps/tri-guard/requirements.txt!"
}

# 5. Start Gateway (Node.js / Fastify) locally in a new window
Write-Host "[*] Launching Gateway Node.js service (Port 3000)..." -ForegroundColor Yellow
$GatewayCmd = @"
Set-Location '$RootPath'
`$env:PORT = '3000'
`$env:HOST = '0.0.0.0'
`$env:REDIS_URL = 'redis://localhost:6379'
`$env:KAFKA_BROKERS = 'localhost:19092'
`$env:TRI_GUARD_URL = 'http://localhost:8000'
`$env:POLICY_SERVICE_URL = 'http://localhost:8001'
`$env:AUDIT_SERVICE_URL = 'http://localhost:8002'
Write-Host 'Gateway: Starting Fastify on port 3000...' -ForegroundColor Cyan
npm run dev --workspace=@controlplane/gateway
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $GatewayCmd -WindowStyle Normal

Start-Sleep -Seconds 5

# 6. Start Dashboard (Next.js) locally in a new window
Write-Host "[*] Launching Dashboard (Next.js) on Port 3001..." -ForegroundColor Yellow
$DashboardCmd = @"
Set-Location '$RootPath'
`$env:PORT = '3001'
Write-Host 'Dashboard: Starting Next.js on port 3001...' -ForegroundColor Cyan
npm run dev --workspace=dashboard
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $DashboardCmd -WindowStyle Normal

# 7. Done!
Write-Host "" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  ControlPlane.ai services started!          " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Service URLs:" -ForegroundColor White
Write-Host "  Dashboard:      http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Gateway:        http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Tri-Guard:      http://localhost:8000" -ForegroundColor Yellow
Write-Host "  Policy Service: http://localhost:8001" -ForegroundColor Yellow
Write-Host "  Audit Service:  http://localhost:8002" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Health checks:" -ForegroundColor White
Write-Host "  Invoke-WebRequest http://localhost:3000/health" -ForegroundColor Gray
Write-Host "  Invoke-WebRequest http://localhost:8000/health" -ForegroundColor Gray
Write-Host "  Invoke-WebRequest http://localhost:8001/health" -ForegroundColor Gray
Write-Host "  Invoke-WebRequest http://localhost:8002/health" -ForegroundColor Gray
Write-Host ""
Write-Host "  Test LLM proxy (mock mode, no upstream key needed):" -ForegroundColor White
Write-Host '  Invoke-WebRequest -Uri http://localhost:3000/v1/chat/completions -Method POST -Headers @{"x-api-key"="cp_test_tenant_default";"Content-Type"="application/json"} -Body '"'"'{"model":"mock","messages":[{"role":"user","content":"Hello!"}]}'"'" -ForegroundColor Gray
Write-Host "  Login at: http://localhost:3001/login (any email + password)" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Green
