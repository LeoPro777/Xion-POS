"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Keyboard,
  ShoppingCart,
  Package,
  Users,
  HelpCircle,
  BookOpen,
  Video,
  MessageCircle,
  Mail,
} from "lucide-react"
import { useState } from "react"

interface HelpTopic {
  id: string
  title: string
  description: string
  category: string
  icon: React.ElementType
}

const helpTopics: HelpTopic[] = [
  {
    id: "1",
    title: "Realizar una Venta",
    description: "Aprende cómo procesar ventas, agregar productos al carrito y cobrar con múltiples métodos de pago.",
    category: "ventas",
    icon: ShoppingCart,
  },
  {
    id: "2",
    title: "Gestionar Inventario",
    description: "Administra tu inventario, agrega nuevos productos, actualiza stock y establece precios.",
    category: "inventario",
    icon: Package,
  },
  {
    id: "3",
    title: "Atajos de Teclado",
    description: "Lista completa de atajos de teclado para trabajar más rápido en el sistema POS.",
    category: "general",
    icon: Keyboard,
  },
  {
    id: "4",
    title: "Gestión de Usuarios",
    description: "Crea y administra usuarios, asigna roles y permisos para tu equipo.",
    category: "usuarios",
    icon: Users,
  },
  {
    id: "5",
    title: "Arqueo de Caja",
    description: "Realiza el cierre de caja diario y compara los montos del sistema con el efectivo real.",
    category: "caja",
    icon: ShoppingCart,
  },
  {
    id: "6",
    title: "Configuración Inicial",
    description: "Configura tu tienda, métodos de pago, impuestos y preferencias del sistema.",
    category: "configuracion",
    icon: HelpCircle,
  },
]

const keyboardShortcuts = [
  { key: "F1", action: "Buscar producto" },
  { key: "F3", action: "Aplicar descuento" },
  { key: "F5", action: "Cobrar / Procesar pago" },
  { key: "F10", action: "Opciones de venta" },
  { key: "Ctrl + N", action: "Nueva venta" },
  { key: "Ctrl + S", action: "Guardar cambios" },
  { key: "Esc", action: "Cancelar / Cerrar" },
]

export function HelpModule() {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredTopics = helpTopics.filter(
    (topic) =>
      topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto bg-background/50 p-6">
      {/* Search */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar en la ayuda..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 rounded-xl border-2 border-primary/30 bg-card pl-12 text-base focus:border-primary focus:ring-primary"
        />
      </div>

      {/* Quick access cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border/50 shadow-md hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Documentación</h3>
              <p className="text-sm text-muted-foreground">Guías completas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-md hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
              <Video className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Video Tutoriales</h3>
              <p className="text-sm text-muted-foreground">Aprende visualmente</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-md hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
              <MessageCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Chat en Vivo</h3>
              <p className="text-sm text-muted-foreground">Soporte directo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Help topics */}
      <div>
        <h2 className="mb-4 text-xl font-bold text-foreground">Temas de Ayuda</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredTopics.map((topic) => (
            <Card
              key={topic.id}
              className="border-border/50 shadow-md hover:shadow-lg transition-all cursor-pointer hover:border-primary/50"
            >
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <topic.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base font-semibold text-foreground">
                      {topic.title}
                    </CardTitle>
                    <Badge variant="secondary" className="mt-2 text-xs capitalize">
                      {topic.category}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{topic.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Keyboard shortcuts */}
      <div>
        <h2 className="mb-4 text-xl font-bold text-foreground">Atajos de Teclado</h2>
        <Card className="border-border/50 shadow-md">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {keyboardShortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-4 py-3"
                >
                  <span className="text-sm text-foreground">{shortcut.action}</span>
                  <kbd className="rounded bg-foreground px-2 py-1 font-mono text-xs font-semibold text-background">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact support */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-transparent shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Mail className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">¿Necesitas más ayuda?</h3>
              <p className="text-sm text-muted-foreground">
                Contacta a nuestro equipo de soporte: soporte@possystem.com
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
