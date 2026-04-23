import React, { useEffect, useState } from 'react';
import '../styles/globals.css';
import { DashboardScreen } from '@/components/pos/dashboard-screen';
import { LoginScreen } from '@/components/pos/login-screen';
import { apiClient } from '@/lib/api';
import { useSystemStatus } from '@/hooks/queries/use-system';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';

type BootState = 'checking' | 'ready' | 'failed';

export default function App() {
  const [bootState, setBootState] = useState<BootState>('checking');
  const [error, setError] = useState<string>('');
  
  // Seguridad activada: falso por defecto, requiere login
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const { toast } = useToast();

  const { data: config } = useSystemStatus();

  useEffect(() => {
    if (config) {
      const root = document.documentElement;

      // 1. Theme Class Management
      if (config.theme_mode === 'dark') {
        root.classList.add('dark');
      } else if (config.theme_mode === 'light') {
        root.classList.remove('dark');
      } else {
        // auto
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }

      // 2. Dynamic Style Tag Management (Better cascade for Tailwind v4 variables)
      let styleTag = document.getElementById('xion-pos-dynamic-prefs');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'xion-pos-dynamic-prefs';
        document.head.appendChild(styleTag);
      }

      const cssLines = [`:root, .dark {`];

      // Primary Color
      if (config.primary_color) {
        // Helper to determine contrasting text (black or white) based on hex
        const hex = config.primary_color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        const fgColor = (yiq >= 128) ? '#0F172A' : '#FFFFFF';

        // Override both the internal Tailwind token and standard variables
        cssLines.push(`  --color-primary: ${config.primary_color} !important;`);
        cssLines.push(`  --primary: ${config.primary_color} !important;`);
        // Ensure contrast and integration across the UI
        cssLines.push(`  --color-primary-foreground: ${fgColor} !important;`);
        cssLines.push(`  --primary-foreground: ${fgColor} !important;`);
        cssLines.push(`  --color-ring: ${config.primary_color}80 !important;`);
        cssLines.push(`  --ring: ${config.primary_color}80 !important;`);
        cssLines.push(`  --color-sidebar-primary: ${config.primary_color} !important;`);
        cssLines.push(`  --sidebar-primary: ${config.primary_color} !important;`);
        cssLines.push(`  --color-sidebar-primary-foreground: ${fgColor} !important;`);
        cssLines.push(`  --sidebar-primary-foreground: ${fgColor} !important;`);
        cssLines.push(`  --color-sidebar-ring: ${config.primary_color}80 !important;`);
        cssLines.push(`  --sidebar-ring: ${config.primary_color}80 !important;`);
      }

      // Interface Density (Radius)
      if (config.interface_density === 'compact') {
        cssLines.push(`  --radius: 0.3rem !important;`);
      } else if (config.interface_density === 'comfortable') {
        cssLines.push(`  --radius: 1rem !important;`);
      } else {
        cssLines.push(`  --radius: 0.625rem !important;`);
      }

      // Compact Mode (Spacing reduction)
      if (config.compact_mode) {
        cssLines.push(`  --spacing: 0.2rem !important;`);
      }

      // Animations
      if (!config.animations) {
        cssLines.push(`  --animate-duration: 0s !important;`);
        cssLines.push(`  * { transition: none !important; animation: none !important; scroll-behavior: auto !important; }`);
      }

      // High Contrast
      if (config.high_contrast) {
        cssLines.push(`  filter: contrast(1.15) !important;`);
      }

      cssLines.push(`}`);

      // Apply root scale safely
      cssLines.push(`html { font-size: ${config.font_size || 16}px !important; }`);

      styleTag.innerHTML = cssLines.join('\n');
    }
  }, [config]);

  useEffect(() => {
    let isMounted = true;

    const boot = async () => {
      try {
        await apiClient.initialize();
        if (isMounted) setBootState('ready');
      } catch (err) {
        console.error('[App] Backend initialization failed', err);
        if (isMounted) {
          setError('No se pudo conectar con el backend local. Revisa que Python esté listo.');
          setBootState('failed');
        }
      }
    };

    boot();
    return () => {
      isMounted = false;
    };
  }, []);

  if (bootState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Iniciando Xion POS...</h1>
          <p className="text-slate-300 mt-2">Verificando backend local...</p>
        </div>
      </div>
    );
  }

  if (bootState === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4">
        <div className="bg-slate-900 rounded-xl border border-red-500 p-6 max-w-lg">
          <h1 className="text-xl font-bold text-red-300">Backend no disponible</h1>
          <p className="mt-2 text-slate-200">{error}</p>
          <button
            className="mt-4 rounded-md px-4 py-2 bg-sky-500 text-slate-900 font-semibold"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  /* * Flujo de Autenticación
   * Bypass temporal activo para desarrollo mediante LoginScreen.
   */
  if (!isAuthenticated) {
    return <LoginScreen onLogin={(user) => setIsAuthenticated(true)} />;
  }

  return (
    <>
      <DashboardScreen 
        onLogout={() => {
          // En modo desarrollo puedes dejar esto vacío o que simplemente cambie el estado
          console.log("Cerrando sesión...");
          setIsAuthenticated(false); 
        }} 
      />
      <Toaster />
    </>
  );
}
