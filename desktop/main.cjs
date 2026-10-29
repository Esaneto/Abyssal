const { app, BrowserWindow, shell } = require('electron');

const GAME_URL = 'https://abyssal-ej5j.onrender.com';
let mainWindow;

function isGameUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'abyssal-ej5j.onrender.com';
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 600,
    backgroundColor: '#061522',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isGameUrl(url)) {
      mainWindow.loadURL(url);
    } else if (url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isGameUrl(url)) event.preventDefault();
  });

  mainWindow.loadURL(GAME_URL);
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('browser-window-created', (_event, window) => {
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      event.preventDefault();
      window.setFullScreen(!window.isFullScreen());
    } else if (input.key === 'Escape' && window.isFullScreen()) {
      window.setFullScreen(false);
    }
  });
});