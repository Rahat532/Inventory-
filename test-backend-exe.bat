@echo off
echo Testing standalone backend executable...
echo.

if not exist "backend\dist\ims-backend.exe" (
    echo ERROR: Backend executable not found!
    echo Please run rebuild-backend-only.bat first.
    pause
    exit /b 1
)

echo Starting backend on http://127.0.0.1:8000
echo Press Ctrl+C to stop
echo.

cd backend\dist
ims-backend.exe

pause
