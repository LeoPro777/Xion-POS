"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Bell,
  CircleHelp,
  Settings,
  LogOut,
  User,
  Wifi,
  Wrench,
  Palette,
  Store,
} from "lucide-react"
import { useActiveSession } from "@/hooks/queries/use-cash-register"

interface DashboardHeaderProps {
  title: string
  exchangeRate: number
  onLogout: () => void
  onNavigate: (module: string) => void
  currentUser?: any
  onOpenCaja?: () => void
  onCloseCaja?: () => void
}

export function DashboardHeader({ title, exchangeRate, onLogout, onNavigate, currentUser, onOpenCaja, onCloseCaja }: DashboardHeaderProps) {
  const initials = (currentUser?.name || "Cajero de Desarrollo")
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const getRoleLabel = (role?: string) => {
    if (!role) return "Usuario Local";
    switch (role.toLowerCase()) {
      case "manager":
        return "Administrador General";
      case "cashier":
        return "Cajero Autorizado";
      default:
        return role;
    }
  };

  const { data: activeSession } = useActiveSession()

  return (
    <header className="flex h-20 items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm px-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground">Bienvenido de vuelta</p>
      </div>

      <div className="flex items-center gap-6">

        <div className="flex items-center gap-3 rounded-lg bg-secondary/80 px-4 py-2 border border-border/40 shadow-sm">
          <span className="text-sm font-medium text-foreground">Tasa:</span>
          <span className="font-mono text-lg font-bold text-primary">
            {exchangeRate.toFixed(2)} Bs
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-secondary/80 px-4 py-2 border border-border/40 shadow-sm">
          <Wifi className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium text-foreground">Conectado</span>
        </div>

        <button className="relative flex h-10 w-10 items-center justify-center rounded-lg transition-all hover:bg-accent/50">
          <Bell className="h-5 w-5 text-foreground" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="sr-only">Notificaciones</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 rounded-lg transition-all hover:bg-accent/50 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground select-none">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">Perfil de usuario</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 text-sm font-semibold text-foreground">
              {currentUser?.name || "Cajero de Desarrollo"}
            </div>
            <div className="px-2 pb-2 text-xs text-muted-foreground">
              {getRoleLabel(currentUser?.role)}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNavigate("Perfil")}>
              <User className="mr-2 h-4 w-4" />
              <span>Mi Perfil</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-10 w-10 items-center justify-center rounded-lg transition-all hover:bg-accent/50">
              <Settings className="h-5 w-5 text-foreground" />
              <span className="sr-only">Configuracion general</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => onNavigate("Cuenta")}>
              <Store className="mr-2 h-4 w-4" />
              <span>Suscripción y Cuenta</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNavigate("Configuraciones")}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configuraciones</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigate("Preferencias")}>
              <Palette className="mr-2 h-4 w-4" />
              <span>Preferencias</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigate("Ayuda")}>
              <CircleHelp className="mr-2 h-4 w-4" />
              <span>Ayuda</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
