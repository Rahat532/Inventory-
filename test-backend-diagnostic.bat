@echo off
echo =============================================
echo   Backend Diagnostic Test
echo =============================================
echo.
echo This will test if the backend is working properly
echo.

REM Check if backend is running
echo [1/3] Checking if backend is running on port 8000...
curl -s http://127.0.0.1:8000/health >nul 2>&1
if errorlevel 1 (
    echo ✗ Backend is NOT running on port 8000
    echo.
    echo Please start the backend first:
    echo   Option 1: Run start-backend-manual.bat
    echo   Option 2: Run the Electron app which auto-starts it
    echo.
    pause
    exit /b 1
) else (
    echo ✓ Backend is running
)

echo.
echo [2/3] Testing Dashboard KPIs endpoint...
python test_backend_endpoints.py

echo.
echo [3/3] Diagnostic complete!
echo.
echo If you see errors above, check the console in your Electron app
echo (Press Ctrl+Shift+I to open DevTools)
echo.
pause
