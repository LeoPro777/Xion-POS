import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutoUpdater, AutoUpdaterProvider } from '@/hooks/use-auto-updater';
import * as ToastHook from '@/hooks/use-toast';

describe('useAutoUpdater Hook', () => {
    const mockToast = vi.fn();
    let mockOnUpdateAvailable: any;
    let mockOnUpdateReady: any;
    let mockOnUpdateProgress: any;
    let mockOnUpdateError: any;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AutoUpdaterProvider>{children}</AutoUpdaterProvider>
    );

    beforeEach(() => {
        // Simulamos el useToast de Shadcn
        vi.spyOn(ToastHook, 'useToast').mockReturnValue({ toast: mockToast } as any);

        // Simulamos la API expuesta por el Preload de Electron
        mockOnUpdateAvailable = vi.fn().mockReturnValue(vi.fn()); // Retorna mock de cleanup
        mockOnUpdateReady = vi.fn().mockReturnValue(vi.fn());
        mockOnUpdateProgress = vi.fn().mockReturnValue(vi.fn());
        mockOnUpdateError = vi.fn().mockReturnValue(vi.fn());

        global.window.electronAPI = {
            updater: {
                onUpdateAvailable: mockOnUpdateAvailable,
                onUpdateReady: mockOnUpdateReady,
                onUpdateProgress: mockOnUpdateProgress,
                onUpdateError: mockOnUpdateError,
            }
        } as any;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (global.window as any).electronAPI;
    });

    it('should register event listeners on mount if electronAPI is present', () => {
        renderHook(() => useAutoUpdater(), { wrapper });

        expect(mockOnUpdateAvailable).toHaveBeenCalledTimes(1);
        expect(mockOnUpdateReady).toHaveBeenCalledTimes(1);
    });

    it('should trigger toast when update is available', () => {
        renderHook(() => useAutoUpdater(), { wrapper });

        // Extraemos el callback que el hook le pasó a nuestro mock
        const availableCallback = mockOnUpdateAvailable.mock.calls[0][0];
        
        // Simulamos que Electron emite el evento con la firma correcta { version: string }
        act(() => {
            availableCallback({ version: '2.1.0' });
        });

        expect(mockToast).toHaveBeenCalledWith({
            title: "🔄 Actualización Detectada",
            description: "Descargando la versión 2.1.0 en segundo plano. El sistema seguirá funcionando normalmente.",
            duration: 5000,
        });
    });

    it('should not throw if electronAPI is undefined (running in browser mode)', () => {
        delete (global.window as any).electronAPI;
        
        expect(() => renderHook(() => useAutoUpdater(), { wrapper })).not.toThrow();
        expect(mockOnUpdateAvailable).not.toHaveBeenCalled();
    });
});
