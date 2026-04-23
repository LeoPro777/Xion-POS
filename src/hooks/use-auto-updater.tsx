import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

interface AutoUpdaterContextValue {
    updateState: UpdateState;
    progress: number;
    version: string;
    installUpdate: () => void;
    checkUpdate: () => void;
}

const AutoUpdaterContext = createContext<AutoUpdaterContextValue>({
    updateState: 'idle',
    progress: 0,
    version: '',
    installUpdate: () => {},
    checkUpdate: () => {},
});

export function AutoUpdaterProvider({ children }: { children: React.ReactNode }) {
    const { toast } = useToast();
    const [updateState, setUpdateState] = useState<UpdateState>('idle');
    const [progress, setProgress] = useState<number>(0);
    const [version, setVersion] = useState<string>('');

    useEffect(() => {
        if (typeof window === 'undefined' || !window.electronAPI?.updater) {
            return;
        }

        const unsubscribeAvailable = window.electronAPI.updater.onUpdateAvailable((info: any) => {
            setUpdateState('available');
            setVersion(info.version || '');
            toast({
                title: "🔄 Actualización Detectada",
                description: `Descargando la versión ${info.version || ''} en segundo plano. El sistema seguirá funcionando normalmente.`,
                duration: 5000,
            });
            setUpdateState('downloading');
        });

        const unsubscribeProgress = window.electronAPI.updater.onUpdateProgress((progressObj: any) => {
            setUpdateState('downloading');
            setProgress(progressObj.percent || 0);
        });

        const unsubscribeReady = window.electronAPI.updater.onUpdateReady((ver: string) => {
            setUpdateState('ready');
            setVersion(ver);
            setProgress(100);
            toast({
                title: "✅ Actualización Lista",
                description: `Versión ${ver} descargada. Ve a Cuenta para instalarla o se instalará al salir.`,
                duration: 8000,
            });
        });

        const unsubscribeError = window.electronAPI.updater.onUpdateError((err: string) => {
            setUpdateState('error');
            console.error("Update error:", err);
        });

        return () => {
            unsubscribeAvailable();
            unsubscribeProgress();
            unsubscribeReady();
            unsubscribeError();
        };
    }, [toast]);

    const installUpdate = () => {
        if (window.electronAPI?.updater) {
            window.electronAPI.updater.install();
        }
    };

    const checkUpdate = () => {
        if (window.electronAPI?.updater) {
            setUpdateState('checking');
            window.electronAPI.updater.check();
        }
    };

    return (
        <AutoUpdaterContext.Provider value={{ updateState, progress, version, installUpdate, checkUpdate }}>
            {children}
        </AutoUpdaterContext.Provider>
    );
}

export function useAutoUpdater() {
    return useContext(AutoUpdaterContext);
}
