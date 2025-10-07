const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
// Use Electron's built-in flag instead of electron-is-dev so prod builds don't require that package
const isDev = !app.isPackaged;
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const http = require('http');

let mainWindow;
let splashWindow;
let backendProcess;

// Simple logger to userData
function logLine(...args) {
  try {
    const p = app.getPath('userData') ? path.join(app.getPath('userData'), 'ims-log.txt') : null;
    const line = `[${new Date().toISOString()}] ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
    if (p) fs.appendFileSync(p, line, { encoding: 'utf8' });
  } catch {}
}

// Reduce crashes on some GPUs (observed GPU process exit); prefer stability for prod
app.disableHardwareAcceleration();

function createWindow() {
  if (mainWindow) {
    try { mainWindow.focus(); } catch {}
    return;
  }
  // Create the browser window
  const iconPath = path.join(__dirname, 'assets/icon.png');
  const hasIcon = require('fs').existsSync(iconPath);
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      // Enable web security even during development for closer prod parity
      webSecurity: true
    },
    ...(hasIcon ? { icon: iconPath } : {}),
    show: false, // Don't show until ready
    backgroundColor: '#111827'
  });

  // Decide source: prefer dev server only when explicitly available; otherwise load build
  const devUrl = 'http://localhost:3000';
  const prodIndexPath = path.join(__dirname, '../build/index.html');
  let usingDevServer = isDev && process.env.USE_DEV_SERVER !== '0';

  const loadProd = () => {
    usingDevServer = false;
    logLine('Loading PRODUCTION build at file:', prodIndexPath);
    // Use loadFile so CRA "homepage": "./" assets resolve properly under file://
    mainWindow.loadFile(prodIndexPath);
  };

  const loadDev = () => {
    logLine('Loading DEV server at:', devUrl);
    mainWindow.loadURL(devUrl);
    // If dev server fails to load, fallback to prod build automatically
  };

  // Try dev server first (during development), fallback to prod build if it fails
  if (usingDevServer) {
    loadDev();
  } else {
    loadProd();
  }

  // Fallback when load fails (e.g., dev server not running)
  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription) => {
    if (usingDevServer) {
      logLine('Dev server failed to load:', errorCode, errorDescription, '– Falling back to production build.');
      loadProd();
    }
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Close splash once main window is ready
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('close', (e) => {
    const { dialog } = require('electron');
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['No', 'Yes'],
      defaultId: 0,
      cancelId: 0,
      title: 'Confirm Exit',
      message: 'Do you want to Exit?',
      detail: 'Any ongoing operations will be stopped.'
    });
    if (choice === 0) {
      e.preventDefault();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 600,
    height: 380,
    resizable: false,
    movable: true,
    frame: false,
    alwaysOnTop: true,
    transparent: false,
    center: true,
    backgroundColor: '#111827',
    webPreferences: {
      nodeIntegration: true, // only for this local splash page
      contextIsolation: false,
    },
    show: false,
  });

  const splashPath = path.join(__dirname, 'splash.html');
  splashWindow.loadFile(splashPath);
  splashWindow.once('ready-to-show', () => {
    // Send version info to splash
    const version = app.getVersion ? app.getVersion() : '1.0.0';
    try { splashWindow.webContents.send('app-version', version); } catch {}
    splashWindow.show();
  });

  // When splash requests start, spin up backend then open main window
  ipcMain.once('splash-start', async () => {
    try {
      // Start backend (skips if already running) and wait briefly for readiness
      await startBackend(true);
      await waitForPort(8000, '127.0.0.1', 6000).catch(() => {});
    } catch (e) {
      console.error('Error starting backend from splash:', e);
      try {
        if (splashWindow) splashWindow.webContents.send('backend-error', String(e?.message || e));
      } catch {}
    }
    createWindow();
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Product',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-product');
          }
        },
        {
          label: 'Generate Report',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.send('menu-generate-report');
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('menu-settings');
          }
        },
        { type: 'separator' },
        {
          label: isDev ? 'Quit' : 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow.webContents.send('menu-navigate', '/');
          }
        },
        {
          label: 'Products',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow.webContents.send('menu-navigate', '/products');
          }
        },
        {
          label: 'Categories',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            mainWindow.webContents.send('menu-navigate', '/categories');
          }
        },
        {
          label: 'Sales',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            mainWindow.webContents.send('menu-navigate', '/sales');
          }
        },
        {
          label: 'Reports',
          accelerator: 'CmdOrCtrl+5',
          click: () => {
            mainWindow.webContents.send('menu-navigate', '/reports');
          }
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.reload();
          }
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            mainWindow.webContents.reloadIgnoringCache();
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            const version = app.getVersion ? app.getVersion() : '1.0.0';
            require('electron').dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About',
              message: 'Inventory Management System',
              detail: `Version ${version}\nA modern desktop inventory management solution.`
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function isPortOpen(port, host = '127.0.0.1', timeoutMs = 400) {
  try {
    await waitForPort(port, host, timeoutMs);
    return true;
  } catch {
    return false;
  }
}

function checkIMSHealth(baseUrl = 'http://127.0.0.1:8000', timeoutMs = 1000) {
  return new Promise((resolve) => {
    const req = http.get(`${baseUrl}/health`, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body || '{}');
          resolve(json && json.status === 'healthy');
        } catch {
          resolve(false);
        }
      });
    });
    req.on('timeout', () => { try { req.destroy(); } catch {} resolve(false); });
    req.on('error', () => resolve(false));
  });
}

function resolvePythonCmd(devBackendPath) {
  // Prefer venv python on Windows in dev
  try {
    if (process.platform === 'win32' && devBackendPath) {
      const venvPy = path.join(devBackendPath, 'venv', 'Scripts', 'python.exe');
      if (require('fs').existsSync(venvPy)) return venvPy;
    }
  } catch {}
  // Fallbacks
  return process.platform === 'win32' ? 'python' : 'python3';
}

async function startBackend(force = false) {
  // If something is already listening on 8000, don't start another backend
  const alreadyRunning = await isPortOpen(8000, '127.0.0.1', 350);
  if (alreadyRunning) {
    const healthy = await checkIMSHealth('http://127.0.0.1:8000', 1200);
    if (healthy) {
      console.log('[Backend] Already healthy on http://127.0.0.1:8000, skipping spawn.');
      return;
    } else {
      console.log('[Backend] Port 8000 is occupied by another service that is not IMS.');
      try {
        dialog.showErrorBox('Port In Use', 'Another application is using port 8000. Please close it and restart the app.');
      } catch {}
      return; // Without a dynamic port handoff to renderer, safest is to stop here.
    }
  }
  if (!isDev) {
    // In production, start the bundled Python backend
    const exeName = process.platform === 'win32' ? 'ims-backend.exe' : 'ims-backend';
    const backendExe = path.join(process.resourcesPath, 'backend', 'dist', exeName);
    
    console.log('[Backend] Looking for exe at:', backendExe);
    console.log('[Backend] process.resourcesPath:', process.resourcesPath);
    console.log('[Backend] Exe exists?', require('fs').existsSync(backendExe));
    
    // Check if bundled backend exists
    if (require('fs').existsSync(backendExe)) {
      console.log('[Backend] Starting bundled exe:', backendExe);
      const dataDir = app.getPath('userData') ? path.join(app.getPath('userData'), 'ims-data') : undefined;
      const env = Object.assign({}, process.env, dataDir ? { IMS_DATA_DIR: dataDir } : {});
      
      // Capture backend output instead of inheriting stdio
      backendProcess = spawn(backendExe, [], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env,
        detached: false
      });
      
      backendProcess.stdout.on('data', (data) => {
        console.log('[Backend stdout]:', data.toString());
      });
      
      backendProcess.stderr.on('data', (data) => {
        console.error('[Backend stderr]:', data.toString());
      });
      
      backendProcess.on('exit', (code) => {
        console.log('[Backend] Process exited with code:', code);
      });
    } else {
      // Fallback to Python script (shouldn't happen in prod)
      const backendPath = path.join(process.resourcesPath, 'backend');
      console.log('[Backend] Exe not found, trying Python from:', backendPath);
      const dataDir = app.getPath('userData') ? path.join(app.getPath('userData'), 'ims-data') : undefined;
      const env = Object.assign({}, process.env, dataDir ? { IMS_DATA_DIR: dataDir } : {});
      
      backendProcess = spawn('python', ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], {
        cwd: backendPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env
      });
      
      backendProcess.stdout.on('data', (data) => {
        console.log('[Backend stdout]:', data.toString());
      });
      
      backendProcess.stderr.on('data', (data) => {
        console.error('[Backend stderr]:', data.toString());
      });
    }

    backendProcess.on('error', (err) => {
      console.error('[Backend] Failed to start:', err);
      // Show error dialog to user
      require('electron').dialog.showErrorBox(
        'Backend Error',
        'Failed to start the backend server.\n\nError: ' + (err.message || err)
      );
      try {
        if (splashWindow) splashWindow.webContents.send('backend-error', String(err?.message || err));
      } catch {}
    });

    // Give backend time to start
    setTimeout(() => {
      console.log('[Backend] Should be ready on http://127.0.0.1:8000');
    }, 2000);
  } else {
    const backendPath = path.join(__dirname, '../../backend');
    if (force) {
      console.log('[Backend] Dev mode: starting from:', backendPath);
      const dataDir = app.getPath('userData') ? path.join(app.getPath('userData'), 'ims-data') : undefined;
      const env = Object.assign({}, process.env, dataDir ? { IMS_DATA_DIR: dataDir } : {});
      const py = resolvePythonCmd(backendPath);
      backendProcess = spawn(py, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], {
        cwd: backendPath,
        stdio: 'inherit',
        windowsHide: true,
        env
      });
      backendProcess.on('error', (err) => {
        console.error('[Backend] Failed to start (dev):', err);
      });
    } else {
      console.log('[Backend] Development mode - backend should be started manually');
    }
  }
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

// App event handlers
app.whenReady().then(async () => {
  createSplashWindow();
  // Proactively start backend and wait a bit longer for readiness
  try {
    await startBackend(true);
    await waitForPort(8000, '127.0.0.1', 10000).catch(() => {});
  } catch (e) {
    console.error('Error during backend auto-start:', e);
  }
  // Auto-open main window if not already created by splash interaction
  setTimeout(() => {
    try { createWindow(); } catch (e) { console.error('Failed to create main window:', e); }
  }, 500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});

// Handle app termination
process.on('SIGTERM', () => {
  stopBackend();
  app.quit();
});

process.on('SIGINT', () => {
  stopBackend();
  app.quit();
});

// Utility: wait for TCP port to be connectable
function waitForPort(port, host = '127.0.0.1', timeoutMs = 8000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.connect({ port, host });
      let done = false;
      socket.on('connect', () => { done = true; socket.destroy(); resolve(true); });
      socket.on('error', () => { if (!done) socket.destroy(); retry(); });
      socket.setTimeout(1200, () => { if (!done) { socket.destroy(); retry(); } });
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('Timeout waiting for port'));
      setTimeout(tryConnect, 250);
    };
    tryConnect();
  });
}