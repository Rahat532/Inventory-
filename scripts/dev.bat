@echo off
REM Development script for Inventory Management System on Windows

echo Starting Inventory Management System in development mode...

REM Start backend server in a new window
echo Starting backend server...
start "Backend Server" cmd /k "cd backend && python main.py"

REM Wait a moment for backend to start
timeout /t 3

REM Start frontend in development mode
echo Starting frontend development server...
cd frontend
npm run electron-dev

cd ..