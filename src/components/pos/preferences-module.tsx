"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  Palette,
  Type,
  Monitor,
  Sun,
  Moon,
  Laptop,
  Save,
} from "lucide-react"
import { useState, useEffect } from "react"
import { useSystemStatus, useUpdateSystem } from "@/hooks/queries/use-system"
import { toast } from "sonner"

export function PreferencesModule() {
  const { data: config, isLoading } = useSystemStatus()
  const updateSystem = useUpdateSystem()

  const [theme, setTheme] = useState("light")
  const [fontSize, setFontSize] = useState([16])
  const [primaryColor, setPrimaryColor] = useState("#132DA8")
  const [compactMode, setCompactMode] = useState(false)
  const [animations, setAnimations] = useState(true)
  const [highContrast, setHighContrast] = useState(false)
  const [interfaceDensity, setInterfaceDensity] = useState("normal")

  useEffect(() => {
    if (config) {
      setTheme(config.theme_mode || "light")
      setFontSize([config.font_size || 16])
      setPrimaryColor(config.primary_color || "#132DA8")
      setCompactMode(config.compact_mode ?? false)
      setAnimations(config.animations ?? true)
      setHighContrast(config.high_contrast ?? false)
      setInterfaceDensity(config.interface_density || "normal")
    }
  }, [config])

  const handleSave = async () => {
    try {
      await updateSystem.mutateAsync({
        theme_mode: theme,
        font_size: fontSize[0],
        primary_color: primaryColor,
        compact_mode: compactMode,
        animations: animations,
        high_contrast: highContrast,
        interface_density: interfaceDensity,
      })
      toast.success("Preferencias del sistema actualizadas exitosamente")
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Error actualizando preferencias locales")
    }
  }

  const themeOptions = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Oscuro", icon: Moon },
    { value: "auto", label: "Automático", icon: Laptop },
  ]

  const colorPresets = [
    { name: "Azul", value: "#132DA8" },
    { name: "Verde", value: "#059669" },
    { name: "Morado", value: "#7C3AED" },
    { name: "Naranja", value: "#EA580C" },
    { name: "Rosa", value: "#DB2777" },
    { name: "Cyan", value: "#0891B2" },
  ]

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto bg-background/50 p-6">
      {/* Theme Settings */}
      <Card className="border-border/50 shadow-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Tema y Colores</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme selector */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-foreground">
              Modo de Tema
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={theme === option.value ? "default" : "outline"}
                  className={`h-24 flex-col gap-2 ${
                    theme === option.value
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent/50"
                  }`}
                  onClick={() => setTheme(option.value)}
                >
                  <option.icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{option.label}</span>
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Color presets */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-foreground">
              Color Principal
            </Label>
            <div className="grid grid-cols-6 gap-3">
              {colorPresets.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setPrimaryColor(color.value)}
                  className={`group relative h-16 rounded-xl transition-all hover:scale-105 ${
                    primaryColor === color.value
                      ? "ring-4 ring-foreground ring-offset-2"
                      : ""
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                >
                  {primaryColor === color.value && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-6 w-6 rounded-full bg-white shadow-lg" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* High contrast */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-semibold text-foreground">
                Alto Contraste
              </Label>
              <p className="text-xs text-muted-foreground">
                Mejora la visibilidad con mayor contraste
              </p>
            </div>
            <Switch checked={highContrast} onCheckedChange={setHighContrast} />
          </div>
        </CardContent>
      </Card>

      {/* Typography Settings */}
      <Card className="border-border/50 shadow-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Type className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Tipografía</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Font size */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-foreground">
                Tamaño de Fuente
              </Label>
              <span className="text-sm font-medium text-muted-foreground">
                {fontSize[0]}px
              </span>
            </div>
            <Slider
              value={fontSize}
              onValueChange={setFontSize}
              min={12}
              max={20}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Pequeño (12px)</span>
              <span>Mediano (16px)</span>
              <span>Grande (20px)</span>
            </div>
          </div>

          <Separator />

          {/* Font family preview */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-foreground">
              Vista Previa
            </Label>
            <div
              className="rounded-lg border border-border/50 bg-muted/30 p-4"
              style={{ fontSize: `${fontSize[0]}px` }}
            >
              <p className="font-semibold text-foreground">
                Sistema de Punto de Venta
              </p>
              <p className="mt-2 text-muted-foreground">
                Este es un ejemplo de cómo se verá el texto con el tamaño
                seleccionado. 0123456789
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card className="border-border/50 shadow-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Monitor className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Visualización</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-semibold text-foreground">
                Modo Compacto
              </Label>
              <p className="text-xs text-muted-foreground">
                Reduce el espaciado para ver más información
              </p>
            </div>
            <Switch checked={compactMode} onCheckedChange={setCompactMode} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-semibold text-foreground">
                Animaciones
              </Label>
              <p className="text-xs text-muted-foreground">
                Activa transiciones y efectos visuales
              </p>
            </div>
            <Switch checked={animations} onCheckedChange={setAnimations} />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-sm font-semibold text-foreground">
              Densidad de la Interfaz
            </Label>
            <Select value={interfaceDensity} onValueChange={setInterfaceDensity}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compacta</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="comfortable">Cómoda</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" className="h-12 px-6" onClick={() => window.location.reload()}>
          Descartar Cambios
        </Button>
        <Button 
          disabled={isLoading || updateSystem.isPending} 
          onClick={handleSave} 
          className="h-12 gap-2 bg-primary px-8 text-primary-foreground hover:bg-primary/90"
        >
          <Save className="h-4 w-4" />
          {updateSystem.isPending ? "Aplicando..." : "Guardar Cambios"}
        </Button>
      </div>
    </div>
  )
}
