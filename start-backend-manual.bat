@echo off
echo Starting Inventory Management Backend...
echo.

cd /d "%~dp0backend"

REM Activate venv if it exists
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo WARNING: Virtual environment not found!
    echo.
)

REM Start the backend
echo Starting FastAPI server on http://127.0.0.1:8000
echo Press Ctrl+C to stop the server
echo.
python main.py

pause
