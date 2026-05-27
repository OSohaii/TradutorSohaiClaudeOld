# MangaLens Launcher Script
# Usage: Right-click this file and select "Run with PowerShell",
#        or run from a terminal: .\start.ps1
#        or double-click start.bat (which calls this script automatically)
#
# This script pulls latest changes, installs dependencies,
# starts backend and frontend in separate windows, and opens the browser.

# --- Configuration ---
$ProjectPath = $PSScriptRoot
$BackendPath = Join-Path $ProjectPath "backend"
$FrontendUrl = "http://localhost:3000"

# --- Navigate to project directory ---
Set-Location $ProjectPath

# --- Header ---
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "          MangaLens Launcher" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project: $ProjectPath" -ForegroundColor Gray
Write-Host ""

# --- Step 1: Git Pull ---
Write-Host "[1/4] Pulling latest changes from git..." -ForegroundColor Yellow
try {
    git pull origin main 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    Write-Host "  Git pull completed." -ForegroundColor Green
} catch {
    Write-Host "  Warning: git pull failed, continuing anyway..." -ForegroundColor Red
}
Write-Host ""

# --- Step 2: Install npm dependencies ---
Write-Host "[2/4] Installing npm dependencies..." -ForegroundColor Yellow
try {
    npm install 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    Write-Host "  npm install completed." -ForegroundColor Green
} catch {
    Write-Host "  Error: npm install failed." -ForegroundColor Red
}
Write-Host ""

# --- Step 3: Install Python backend dependencies ---
Write-Host "[3/4] Installing Python backend dependencies..." -ForegroundColor Yellow
try {
    pip install -r "$BackendPath\requirements.txt" 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    Write-Host "  pip install completed." -ForegroundColor Green
} catch {
    Write-Host "  Error: pip install failed." -ForegroundColor Red
}
Write-Host ""

# --- Step 4: Start services ---
Write-Host "[4/4] Starting services..." -ForegroundColor Yellow
Write-Host ""

# Start backend in a new PowerShell window
Write-Host "  Starting backend (uvicorn on port 8000)..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$BackendPath'; `$env:DEV='1'; uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000"

# Start frontend in a new PowerShell window
Write-Host "  Starting frontend (npm run dev on port 3000)..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ProjectPath'; npm run dev"

Write-Host ""
Write-Host "  Waiting 3 seconds for services to start..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Open browser
Write-Host "  Opening browser at $FrontendUrl..." -ForegroundColor Magenta
Start-Process $FrontendUrl

# --- Summary ---
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  MangaLens is running!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend: $FrontendUrl" -ForegroundColor White
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
Write-Host ""
Write-Host "  Two new terminal windows were opened:" -ForegroundColor Gray
Write-Host "    - Backend (uvicorn)" -ForegroundColor Gray
Write-Host "    - Frontend (vite dev server)" -ForegroundColor Gray
Write-Host ""
Write-Host "  To stop: close the terminal windows or press Ctrl+C in each." -ForegroundColor Yellow
Write-Host ""
