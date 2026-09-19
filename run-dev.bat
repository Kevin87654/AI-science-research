@echo off
cd /d "%~dp0"
where pnpm >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 and pnpm 11.19.0 first.
  pause
  exit /b 1
)
if not exist node_modules (
  call pnpm install --frozen-lockfile
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call pnpm dev
pause
