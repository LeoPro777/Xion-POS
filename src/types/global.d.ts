export {};

declare global {
    interface Window {
        electronAPI?: {
            updater: {
                onUpdateAvailable: (callback: (info: any) => void) => () => void;
                onUpdateProgress: (callback: (progressObj: any) => void) => () => void;
                onUpdateReady: (callback: (version: string) => void) => () => void;
                onUpdateError: (callback: (err: string) => void) => () => void;
                install: () => void;
                check: () => void;
            };
            backend: {
                getUrl: () => Promise<string>;
            };
        };
    }
}
