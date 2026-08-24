"use client"

import { cn } from "@/lib/utils"
import {
  BarChart3,
  Monitor,
  Package,
  ShoppingCart,
  Truck,
  Users,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Building2,
  HelpCircle,
  Settings,
  Palette,
} from "lucide-react"
import { useState } from "react"

// Vite Injected Version
declare const __APP_VERSION__: string;

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: ShoppingCart, label: "Ventas" },
  { icon: Truck, label: "Compras" },
  { icon: Package, label: "Inventario" },
  { icon: Users, label: "Usuarios" },
  { icon: UserCircle, label: "Clientes" },
  { icon: Building2, label: "Proveedores" },
  { icon: BarChart3, label: "Reportes" },
]

interface DashboardSidebarProps {
  activeItem: string
  onItemClick: (label: string) => void
}

export function DashboardSidebar({ activeItem, onItemClick }: DashboardSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-card border-r border-border text-card-foreground transition-all duration-300",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Monitor className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">POS</span>
          </div>
        )}
        {isCollapsed && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Monitor className="h-5 w-5 text-primary-foreground" />
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-sidebar-accent"
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-2 px-3 py-6">
        {navItems.map((item) => {
          const isActive = activeItem === item.label
          return (
            <button
              key={item.label}
              onClick={() => onItemClick(item.label)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 transition-all duration-200",
                isActive
                  ? "bg-primary text-white shadow-md font-semibold"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-4 py-4">
        {!isCollapsed && (
          <p className="text-xs text-sidebar-foreground/50">v{__APP_VERSION__}</p>
        )}
      </div>
    </aside>
  )
}
