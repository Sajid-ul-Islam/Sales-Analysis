@echo off
title DEEN Commerce - Enterprise Reconciliation Suite
echo ===================================================================
echo       DEEN COMMERCE - SALES ^& RETURN RECONCILIATION ENGINE
echo       Next.js 14 + Knapsack DP Partial Item Matching Engine
echo ===================================================================
echo.
echo Starting Next.js Application on http://localhost:3000 ...
echo Press Ctrl+C in this terminal window to stop the server anytime.
echo.
timeout /t 2 >nul
start "" http://localhost:3000
npm run dev
pause
