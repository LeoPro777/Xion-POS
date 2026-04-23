// electron_app/src/main/updater.ts
import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import log from 'electron-log';

// Se configura el logger para tener trazabilidad en producción sin depender de la consola.
autoUpdater.logger = log as any;
(autoUpdater.logger as any).transports = (autoUpdater.logger as any).transports || {};
(autoUpdater.logger as any).transports.file = (autoUpdater.logger as any).transports.file || {};
(autoUpdater.logger as any).transports.file.level = 'info';

export class AppUpdater {
    private window: BrowserWindow;

    constructor(window: BrowserWindow) {
        this.window = window;
        
        // El usuario decide cuándo descargar la actualización (ahora modificado a descarga automática)
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;

        this.registerEvents();
    }

    public checkForUpdates(): void {
        log.info('Checking for updates...');
        try {
            autoUpdater.checkForUpdates().catch((error: any) => {
                log.warn('Update check failed (likely offline):', error?.message || error);
            });
        } catch (error) {
            log.error('Critical error initializing update check:', error);
        }
    }

    public downloadUpdate(): void {
        log.info('User requested update download.');
        autoUpdater.downloadUpdate().catch((error: any) => {
            log.error('Error downloading update:', error);
        });
    }

    public installUpdate(): void {
        log.info('User requested install and restart.');
        autoUpdater.quitAndInstall();
    }

    private registerEvents(): void {
        autoUpdater.on('checking-for-update', () => {
            log.info('Update check started.');
        });

        autoUpdater.on('update-available', (info: any) => {
            log.info('Update available:', info.version);
            this.window.webContents.send('update-available', info);
        });

        autoUpdater.on('update-not-available', () => {
            log.info('App is up to date.');
        });

        autoUpdater.on('error', (err: any) => {
            log.warn('Error in auto-updater. System will continue operating offline.', err);
            this.window.webContents.send('update-error', err.message);
        });

        autoUpdater.on('download-progress', (progressObj: any) => {
            // progressObj fields: bytesPerSecond, percent, transferred, total
            this.window.webContents.send('update-progress', progressObj);
        });

        autoUpdater.on('update-downloaded', (info: any) => {
            log.info('Update downloaded. Ready to install.');
            this.window.webContents.send('update-ready', info.version);
        });
    }
}
