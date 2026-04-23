import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import log from 'electron-log';
import { pyManager } from './py_manager';
import { AppUpdater } from './updater';

log.transports.file.level = 'info';
log.transports.console.level = 'debug';

let mainWindow: BrowserWindow | null = null;
let backendUrl = 'http://127.0.0.1:8000';

process.on('uncaughtException', (error: any) => {
  if (error.code === 'EPIPE') {
    return;
  }
  log.error('[Uncaught Exception]', error);
});

async function loadURLWithRetry(win: BrowserWindow, url: string, retries = 30, delayMs = 200): Promise<void> {
  let attempt = 0;
  while (attempt < retries) {
    attempt += 1;
    try {
      await win.loadURL(url);
      return;
    } catch (err) {
      if (attempt >= retries) {
        log.error(`[CRITICAL] Failed to load Vite URL after ${attempt} attempts`, err);
        throw err;
      }
      log.warn(`[WARN] Vite not ready (attempt ${attempt}/${retries}), retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function createWindow(): Promise<BrowserWindow> {
  log.info('[Main] Creating browser window...');
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    log.error(`[CRITICAL] BrowserWindow failed to load URL ${validatedURL} (${errorCode}): ${errorDescription}`);
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    const viteUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    try {
      await loadURLWithRetry(win, viteUrl);
    } catch (err: any) {
      log.error('[CRITICAL] Failed to load Vite URL after retries', err);
      dialog.showErrorBox('Error de Desarrollo', `No se pudo conectar con el servidor de desarrollo de Vite.\n\nDetalle: ${err.message}`);
      app.exit(1);
      return win;
    }
    win.webContents.openDevTools({ mode: 'right' });
  } else {
    const indexFile = path.join(process.resourcesPath, 'out', 'index.html');
    log.info(`[Main] Loading production index from: ${indexFile}`);
    try {
      await win.loadFile(indexFile);
    } catch (err: any) {
      log.error('[CRITICAL] Failed to load production index.html', err);
      dialog.showErrorBox('Error de Producción', `No se encontró el archivo de interfaz (index.html).\n\nDetalle: ${err.message}`);
      app.exit(1);
    }
  }

  return win;
}

// --- SINGLE INSTANCE LOCK ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log.warn('[Main] Second instance detected, quitting...');
  app.quit();
} else {
  app.on('second-instance', () => {
    log.info('[Main] Second instance event triggered.');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    log.info('[Main] App whenReady triggered. Starting backend...');
    try {
      backendUrl = await pyManager.start();
      log.info(`[Main] Backend started successfully at ${backendUrl}`);
    } catch (err: any) {
      log.error('[CRITICAL] Backend failed to start', err);
      const logPath = log.transports.file.getFile().path;
      dialog.showErrorBox(
        'Error Fatal del Sistema',
        `No se pudo iniciar el servicio en segundo plano (Backend).\n\n` + 
        `Posible causa: Faltan dependencias en este PC (ej. Visual C++ Redistributable) o el puerto está ocupado.\n\n` +
        `Detalle: ${err.message || 'Desconocido'}\n\n` +
        `Puedes revisar los logs en: ${logPath}`
      );
      app.quit();
      return;
    }

    ipcMain.handle('get-backend-url', () => backendUrl);

    try {
      mainWindow = await createWindow();
      const updater = new AppUpdater(mainWindow);
      
      ipcMain.on('update-download', () => updater.downloadUpdate());
      ipcMain.on('update-install', () => updater.installUpdate());
      ipcMain.on('update-check', () => updater.checkForUpdates());

      setTimeout(() => updater.checkForUpdates(), 10000);
    } catch (err: any) {
      log.error('[CRITICAL] Initial window/updater failure:', err);
      app.quit();
    }
  });

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createWindow();
    }
  });

  app.on('window-all-closed', () => {
    log.info('[Main] All windows closed, stopping backend and quitting...');
    pyManager.stop();
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('will-quit', () => {
    log.info('[Main] Application will quit, stopping backend...');
    pyManager.stop();
  });
}

