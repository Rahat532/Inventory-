# Sharing Your App Professionally

This guide helps you deliver a polished Windows installer for the Inventory Management System and share it with users.

## 1) Build the Installer
- Run the full builder (includes backend EXE + Electron app):
  - Open Command Prompt:
    - `D:`
    - `cd \Tkinter\IMS`
    - `build-installer.bat`
- Outputs:
  - Installer: `frontend\dist\Inventory Management System-Setup-<version>.exe`
  - Backend EXE: `backend\dist\ims-backend.exe`

## 2) What’s Inside
- Desktop app (Electron) with an integrated backend (FastAPI) started automatically.
- Data is stored per-user in a writable directory:
  - `%APPDATA%\Inventory Management System\ims-data\`
  - Database: `ims-data\database\inventory.db`
  - Uploads: `ims-data\uploads\`

## 3) Professional Installer Settings
- Custom product name and icon
- EULA screen (EULA.txt)
- Start menu and desktop shortcuts
- Choose installation directory (oneClick installer disabled)

## 4) Distributing to Users
- Send only the installer `.exe` from `frontend\dist`.
- Unsigned builds may show Windows SmartScreen; users can click "More info" -> "Run anyway".
- For broad distribution, consider code signing a future build.

## 5) First-Run Checklist
- Splash screen appears and starts backend
- Navigate the app (Dashboard, Products, Sales, Reports, Settings)
- Verify CSV report downloads end with `.csv`
- Create a backup in Settings, then test Restore

## 6) Support & Troubleshooting
- If backend fails to start: ensure antivirus didn’t block the executable, or install Python 3.10+ and contact support.
- If you need to reset app data: close the app and delete `%APPDATA%\Inventory Management System\ims-data`.
- Logs: Use the app’s console (Ctrl+Shift+I) or request logs from the user.

## 7) Future Enhancements
- Code signing the installer
- Auto-update channel with release notes
- In-app error reporting and diagnostics bundle
