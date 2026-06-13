import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';

const isDevelopment = process.env.KLINEFORGE_DESKTOP_DEV === 'true';
const disableGpu = process.env.KLINEFORGE_DISABLE_GPU === 'true';
const openDevTools = process.env.KLINEFORGE_OPEN_DEVTOOLS === 'true';
const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173';
const productionDist = path.resolve(__dirname, '../../dist');
const productionEntry = path.join(productionDist, 'index.html');

if (disableGpu) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
}

let mainWindow: BrowserWindow | null = null;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.focus();
});

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    title: 'KLineForge',
    backgroundColor: '#0b1017',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url);
    const allowedUrl = isDevelopment
      ? target.origin === new URL(devServerUrl).origin
      : target.protocol === 'file:' && target.pathname.startsWith(productionDist);

    if (!allowedUrl) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  if (isDevelopment) {
    await mainWindow.loadURL(devServerUrl);
    if (openDevTools) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    return;
  }

  await mainWindow.loadFile(productionEntry);
}

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    void createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
