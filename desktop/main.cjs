const { app, BrowserWindow, shell, session, protocol } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { URL, pathToFileURL } = require('node:url');

function configuredGameUrl() {
  const explicit = String(process.env.ABYSSAL_NATIVE_SERVER_URL || '').trim();
  const configPath = app.isPackaged
    ? path.join(process.resourcesPath, 'offline-web', 'server-config.js')
    : path.resolve(__dirname, '..', 'public', 'server-config.js');
  const source = fs.readFileSync(configPath, 'utf8');
  const match = source.match(/DEFAULT_NATIVE_SERVER_URL\s*=\s*['"]([^'"]+)['"]/);
  const candidate = explicit || match?.[1] || '';
  const url = new URL(candidate);
  if (url.protocol !== 'https:') throw new Error('Abyssal native server URL must use HTTPS');
  return url.origin;
}
const GAME_URL = configuredGameUrl();
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
        '.webp': 'image/webp',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.woff2': 'font/woff2',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
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

  // Wait until the document and its synchronous cockpit startup are complete.
  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('abyssal://app/')) {
      mainWindow.loadURL(url);
    } else if (url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('abyssal://app/')) { event.preventDefault(); if(url.startsWith('https://'))shell.openExternal(url); }
  });

  // The installed desktop app always boots from bundled assets.
  // Account, multiplayer and rankings use GAME_URL only when requested by the web client.
  // This avoids making app startup depend on DNS, TLS or server availability.
  mainWindow.loadURL(OFFLINE_URL).catch(error => {
    console.error('[Abyssal] Não foi possível abrir os assets locais do jogo:', error);
  });
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
