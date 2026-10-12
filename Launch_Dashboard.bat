@echo off
title DEEN Commerce - Enterprise Reconciliation Suite
echo ===================================================================
echo       DEEN COMMERCE - SALES ^& RETURN RECONCILIATION ENGINE
echo       Next.js 14 + Knapsack DP Partial Item Matching Engine
echo ===================================================================
echo.
echo [1/3] Ensuring Port 3000 is clean...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Terminating stale process on port 3000 (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

echo [2/3] Launching Web Browser at http://localhost:3000 ...
timeout /t 2 >nul
start "" http://localhost:3000

echo [3/3] Starting Next.js Dev Server...
echo Press Ctrl+C in this terminal window to stop the server anytime.
echo.
npm run dev
pause
