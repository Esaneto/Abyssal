const { app, BrowserWindow, shell, session, protocol } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { URL, pathToFileURL } = require('node:url');

const GAME_URL = 'https://abyssal-ej5j.onrender.com';
const GAME_ORIGIN = new URL(GAME_URL).origin;
const OFFLINE_URL = 'abyssal://app/index.html';
let mainWindow;

// Standard + secure are required for localStorage, input controls and canvas
// to behave as they do on the HTTPS site. Do not use file:// as the game's origin.
protocol.registerSchemesAsPrivileged([{
  scheme: 'abyssal',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
}]);

function isGameUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' && url.origin === GAME_ORIGIN) ||
      (url.protocol === 'abyssal:' && url.hostname === 'app');
  } catch {
    return false;
  }
}

function localWebRoot() {
  return app.isPackaged ?
    path.join(process.resourcesPath, 'offline-web') :
    path.resolve(__dirname, '..', 'public');
}

function registerOfflineAssets() {
  const root = localWebRoot();
  protocol.handle('abyssal', async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'app') return new Response('Not found', { status: 404 });
      const requested = decodeURIComponent(url.pathname);
      const filePath = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
      if (!filePath.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
      const content = await fs.promises.readFile(filePath);
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
        '.webmanifest': 'application/manifest+json',
        '.png': 'image/png',
        '.ico': 'image/x-icon'
      }[path.extname(filePath)] || 'application/octet-stream';
      return new Response(content, {
        status: 200,
        headers: { 'content-type': mime, 'cache-control': 'no-store' }
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#061522',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    autoHideMenuBar: true,
    show: false,
    useContentSize: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

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

  let localFallbackStarted = false;
  const loadLocal = () => {
    if (localFallbackStarted || mainWindow?.isDestroyed()) return;
    localFallbackStarted = true;
    mainWindow.loadURL(OFFLINE_URL).catch(error => {
      console.error('[Abyssal] Não foi possível abrir o jogo offline:', error);
    });
  };
  mainWindow.webContents.on('did-fail-load', (_event, code, description, failedUrl, isMainFrame) => {
    if (isMainFrame && code !== -3 && String(failedUrl).startsWith(GAME_ORIGIN)) {
      console.warn('[Abyssal] Servidor indisponível; abrindo modo solo local:', description);
      loadLocal();
    }
  });
  mainWindow.loadURL(GAME_URL).catch(loadLocal);
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.setAppUserModelId('com.esaneto.abyssal');

app.whenReady().then(async () => {
  registerOfflineAssets();
  const ses = session.defaultSession;
  await ses.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
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
