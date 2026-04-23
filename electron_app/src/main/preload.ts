import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Solo exponemos los canales de comunicación específicos para el updater.
// Prevenimos inyección de canales maliciosos o prototipos no deseados.
const api = {
    updater: {
        onUpdateAvailable: (callback: (info: any) => void) => {
            const subscription = (_event: IpcRendererEvent, info: any) => callback(info);
            ipcRenderer.on('update-available', subscription);
            return () => {
                ipcRenderer.removeListener('update-available', subscription);
            };
        },
        onUpdateReady: (callback: (version: string) => void) => {
            const subscription = (_event: IpcRendererEvent, version: string) => callback(version);
            ipcRenderer.on('update-ready', subscription);
            return () => {
                ipcRenderer.removeListener('update-ready', subscription);
            };
        },
        onUpdateProgress: (callback: (progressObj: any) => void) => {
            const subscription = (_event: IpcRendererEvent, progressObj: any) => callback(progressObj);
            ipcRenderer.on('update-progress', subscription);
            return () => {
                ipcRenderer.removeListener('update-progress', subscription);
            };
        },
        onUpdateError: (callback: (errorMsg: string) => void) => {
            const subscription = (_event: IpcRendererEvent, errorMsg: string) => callback(errorMsg);
            ipcRenderer.on('update-error', subscription);
            return () => {
                ipcRenderer.removeListener('update-error', subscription);
            };
        },
        download: () => ipcRenderer.send('update-download'),
        install: () => ipcRenderer.send('update-install'),
        check: () => ipcRenderer.send('update-check')
    },
    backend: {
      getUrl: () => ipcRenderer.invoke('get-backend-url'),
    }
};

contextBridge.exposeInMainWorld('electronAPI', api);
