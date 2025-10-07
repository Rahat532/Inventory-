@echo off
echo =============================================
echo   Building Inventory Management System
echo =============================================
echo.

:: Check requirements
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed
    pause
    exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed
    pause
    exit /b 1
)

:: Build backend requirements
echo Building backend...
cd backend
if not exist "venv" (
    python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt
pip install pyinstaller

:: Create backend executable
echo Creating backend executable...
pyinstaller --onefile --name "ims-backend" main.py
if errorlevel 1 (
    echo ERROR: Failed to build backend executable
    pause
    exit /b 1
)

:: Build frontend
echo Building frontend...
cd ..\frontend
npm install
npm run build
if errorlevel 1 (
    echo ERROR: Failed to build frontend
    pause
    exit /b 1
)

:: Create Electron app
echo Creating desktop application...
npm run dist
if errorlevel 1 (
    echo ERROR: Failed to build desktop app
    pause
    exit /b 1
)

echo.
echo =============================================
echo   Build completed successfully!
echo =============================================
echo.
echo Desktop installer: frontend\dist\
echo Backend executable: backend\dist\ims-backend.exe
echo.
pause