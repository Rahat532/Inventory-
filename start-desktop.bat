@echo off
echo ===========================================
echo   Inventory Management System - Desktop   
echo ===========================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ and try again
    pause
    exit /b 1
)

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js and try again
    pause
    exit /b 1
)

:: Start the backend server
echo Starting backend server...
cd backend

:: Install backend dependencies if needed
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

:: Activate virtual environment
call venv\Scripts\activate

:: Install requirements
pip install -r requirements.txt >nul 2>&1

:: Start backend
echo Backend starting on http://localhost:8000
start /B python -m uvicorn main:app --host 127.0.0.1 --port 8000

:: Wait for backend to start
echo Waiting for backend to initialize...
timeout /t 5 /nobreak >nul

:: Start the desktop application
echo Starting desktop application...
cd ..\frontend

:: Install frontend dependencies if needed
if not exist "node_modules" (
    echo Installing frontend dependencies...
    npm install
)

:: Build if needed
if not exist "build" (
    echo Building application...
    npm run build
)

:: Start Electron app
echo Launching desktop application...
npm run electron

echo.
echo Application has been closed.
pause