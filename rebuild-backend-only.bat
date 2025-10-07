@echo off
echo =============================================
echo   Rebuilding Backend Executable Only
echo =============================================
echo.

cd backend

if not exist "venv" (
    echo ERROR: Virtual environment not found!
    echo Please run build-installer.bat first to create the venv.
    pause
    exit /b 1
)

call venv\Scripts\activate

echo Installing/updating PyInstaller...
pip install pyinstaller

echo.
echo Creating backend executable...
pyinstaller --onefile --name "ims-backend" main.py

if errorlevel 1 (
    echo ERROR: Failed to build backend executable
    pause
    exit /b 1
)

echo.
echo =============================================
echo   Backend exe rebuilt successfully!
echo =============================================
echo.
echo Location: backend\dist\ims-backend.exe
echo.
echo Now you can run: npm run dist
echo from the frontend folder to rebuild the installer.
echo.
pause
