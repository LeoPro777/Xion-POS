"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Server, Monitor, ShieldCheck, Download, Users, Zap, CheckCircle2, RefreshCw } from "lucide-react"
import { useAutoUpdater } from "@/hooks/use-auto-updater"

export function AccountModule() {
  const devices = [
    { id: "PC-CAJA-01", name: "Caja Principal", status: "Activo", type: "Terminal Punto de Venta" },
    { id: "PC-GERENCIA", name: "Laptop Gerencia", status: "Inactivo", type: "Administración" }
  ]

  const { updateState, progress, version, checkUpdate, installUpdate } = useAutoUpdater()

  return (
    <div className="flex-1 overflow-auto bg-background/50 p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Cuenta del Servicio</h2>
          <p className="text-muted-foreground mt-1">Gestión de licencia, plan y equipos afiliados a Xion POS.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Plan Info */}
        <Card className="col-span-full lg:col-span-2 border-border/50 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-xl">Plan Emprendedor (Offline-First)</CardTitle>
              <CardDescription>Facturación híbrida con respaldo en la nube.</CardDescription>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 px-3 py-1 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4 mr-1 inline-block" /> Estado: Activo
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Server className="w-4 h-4" /> Almacenamiento: Ilimitado local</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> Usuarios: Ilimitados</span>
            </div>
            <div className="rounded-xl border border-border/50 bg-secondary/20 p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold text-foreground">Tu licencia vence en: <span className="text-primary font-bold">145 días</span></p>
                <p className="text-sm text-muted-foreground">Renovación automática inactiva</p>
              </div>
              <Button>Renovar Licencia</Button>
            </div>
          </CardContent>
        </Card>

        {/* Sync Status */}
        <Card className="border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl">Sincronización Nube</CardTitle>
            <CardDescription>Estado de los servidores centrales.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Servidor Principal</p>
                  <p className="text-xs text-muted-foreground">Conectado (Latencia: 42ms)</p>
                </div>
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">Datos encolados</span>
                <span className="text-muted-foreground">0 B</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-emerald-500 w-0 transition-all"></div>
              </div>
            </div>

            <Button variant="outline" className="w-full gap-2 text-primary hover:text-primary/90">
              <Zap className="h-4 w-4" /> Forzar Sincronización
            </Button>
          </CardContent>
        </Card>

        {/* Devices Manager */}
        <Card className="col-span-full border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl">Equipos Afiliados</CardTitle>
            <CardDescription>Terminales autorizados para emitir facturas bajo esta licencia.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {devices.map((device, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card hover:bg-accent/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Monitor className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{device.name} <span className="text-xs font-normal text-muted-foreground font-mono ml-2">[{device.id}]</span></p>
                      <p className="text-sm text-muted-foreground">{device.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={device.status === "Activo" ? "default" : "secondary"}>
                      {device.status}
                    </Badge>
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">Revocar</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Updates */}
        <Card className="col-span-full border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl">Actualizaciones del Sistema</CardTitle>
            <CardDescription>Mantén tu sistema al día con las últimas mejoras y parches de seguridad.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center justify-between p-4 rounded-lg border border-border/50 bg-card">
              <div className="flex items-center gap-4 mb-4 md:mb-0">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">
                    Xion POS 
                    {version && <span className="ml-2 text-primary font-mono text-xs">v{version}</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {updateState === 'idle' && "El sistema está actualizado o pendiente de revisión."}
                    {updateState === 'checking' && "Buscando actualizaciones..."}
                    {updateState === 'available' && "Nueva versión disponible."}
                    {updateState === 'downloading' && `Descargando actualización: ${Math.round(progress)}%`}
                    {updateState === 'ready' && "Actualización lista para instalar."}
                    {updateState === 'error' && "Error al buscar o descargar actualización."}
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                {updateState === 'downloading' && (
                  <div className="w-full md:w-48 h-2 rounded-full bg-secondary overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  {(updateState === 'idle' || updateState === 'error') && (
                    <Button onClick={checkUpdate} variant="outline" className="gap-2">
                      <RefreshCw className="h-4 w-4" /> Buscar Actualización
                    </Button>
                  )}
                  {updateState === 'ready' && (
                    <Button onClick={installUpdate} className="gap-2">
                      <Download className="h-4 w-4" /> Instalar y Reiniciar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
