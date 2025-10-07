Inventory Management System — Production Build

Build prerequisites
- Windows 10/11
- Python 3.10+ installed
- Node.js 18+ and npm

Build steps (Windows)
1) Backend executable (optional, Electron can run Python):
   - scripts\build.bat (installs deps, builds React, packages Electron)
   - Or run build-installer.bat for one-click including PyInstaller for backend

2) Electron installer:
   - cd frontend
   - npm run dist
   - Output: frontend\dist\Inventory Management System-Setup-<version>.exe

Runtime notes
- The backend stores data under a user-scoped directory:
  - Windows: %APPDATA%\IMS (or custom via IMS_DATA_DIR env)
  - Subfolders: database\inventory.db, uploads\
- Electron passes IMS_DATA_DIR to the backend process for consistency.

Troubleshooting
- If the app shows blank screen in production:
  - Ensure package.json has homepage:"./" and HashRouter is used under file://
  - Electron logs: inspect console (Ctrl+Shift+I) in dev mode
- If backend doesn’t start in prod:
  - Backend exe path: resources/backend/dist/ims-backend(.exe)
  - Fallback spawns "python -m uvicorn main:app" with IMS_DATA_DIR env
  - Verify Python is installed on the system or ship the exe
