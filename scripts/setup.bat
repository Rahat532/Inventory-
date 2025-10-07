@echo off
REM Complete setup script for Inventory Management System on Windows

echo Setting up Inventory Management System...

REM Check prerequisites
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Python is required but not installed. Aborting.
    exit /b 1
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js is required but not installed. Aborting.
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo npm is required but not installed. Aborting.
    exit /b 1
)

echo ✓ Prerequisites check passed

REM Setup backend
echo Setting up backend...
cd backend

REM Create virtual environment
python -m venv venv
call venv\Scripts\activate

REM Install dependencies
pip install -r requirements.txt

REM Initialize sample data
echo Initializing sample data...
python init_sample_data.py

cd ..

REM Setup frontend
echo Setting up frontend...
cd frontend

REM Install dependencies
npm install

REM Create .env file for development
echo REACT_APP_API_URL=http://localhost:8000/api > .env
echo GENERATE_SOURCEMAP=false >> .env

cd ..

echo ✓ Setup completed successfully!
echo.
echo To start development mode:
echo   scripts\dev.bat
echo.
echo To build for production:
echo   scripts\build.bat
echo.
echo The application will be available at:
echo   Backend API: http://localhost:8000
echo   Frontend: http://localhost:3000
echo   API Docs: http://localhost:8000/docs