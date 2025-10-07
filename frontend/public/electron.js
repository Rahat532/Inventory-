const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { spawn } = require('child_process');
const net = require('net');

let mainWindow;
let splashWindow;
let backendProcess;

// Reduce crashes on some GPUs (observed GPU process exit); prefer stability for prod
app.disableHardwareAcceleration();

function createWindow() {
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
    console.log('Loading PRODUCTION build at file:', prodIndexPath);
    // Use loadFile so CRA "homepage": "./" assets resolve properly under file://
    mainWindow.loadFile(prodIndexPath);
  };

  const loadDev = () => {
    console.log('Loading DEV server at:', devUrl);
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
      console.warn('Dev server failed to load:', errorCode, errorDescription, '– Falling back to production build.');
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
      startBackend(true);
      // Wait briefly for backend port to accept connections (best-effort)
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

function startBackend(force = false) {
  if (!isDev) {
    // In production, start the bundled Python backend
    const exeName = process.platform === 'win32' ? 'ims-backend.exe' : 'ims-backend';
    const backendExe = path.join(process.resourcesPath, 'backend', 'dist', exeName);
    
    // Check if bundled backend exists
    if (require('fs').existsSync(backendExe)) {
      console.log('Starting bundled backend:', backendExe);
      const dataDir = app.getPath('userData') ? require('path').join(app.getPath('userData'), 'ims-data') : undefined;
      const env = Object.assign({}, process.env, dataDir ? { IMS_DATA_DIR: dataDir } : {});
      backendProcess = spawn(backendExe, [], {
        stdio: 'inherit',
        windowsHide: true,
        env
      });
    } else {
      // Fallback to Python script
      const backendPath = path.join(process.resourcesPath, 'backend');
      console.log('Starting Python backend from:', backendPath);
      const dataDir = app.getPath('userData') ? require('path').join(app.getPath('userData'), 'ims-data') : undefined;
      const env = Object.assign({}, process.env, dataDir ? { IMS_DATA_DIR: dataDir } : {});
      backendProcess = spawn('python', ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], {
        cwd: backendPath,
        stdio: 'inherit',
        windowsHide: true,
        env
      });
    }

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend:', err);
      // Show error dialog to user
      require('electron').dialog.showErrorBox(
        'Backend Error',
        'Failed to start the backend server. Please ensure Python is installed and try again.'
      );
      try {
        if (splashWindow) splashWindow.webContents.send('backend-error', String(err?.message || err));
      } catch {}
    });

    // Give backend time to start
    setTimeout(() => {
      console.log('Backend should be running on http://127.0.0.1:8000');
    }, 2000);
  } else {
    if (force) {
      // Start uvicorn in development when forcing prod build testing
      const backendPath = path.join(__dirname, '../../backend');
      console.log('Dev mode forced backend start from:', backendPath);
      const dataDir = app.getPath('userData') ? require('path').join(app.getPath('userData'), 'ims-data') : undefined;
      const env = Object.assign({}, process.env, dataDir ? { IMS_DATA_DIR: dataDir } : {});
      backendProcess = spawn('python', ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], {
        cwd: backendPath,
        stdio: 'inherit',
        windowsHide: true,
        env
      });
      backendProcess.on('error', (err) => {
        console.error('Failed to start backend (forced):', err);
      });
    } else {
      console.log('Development mode - backend should be started manually');
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
app.whenReady().then(() => {
  createSplashWindow();

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