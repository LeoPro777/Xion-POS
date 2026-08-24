"use client"

import { useState } from "react"
import { useSystemStatus } from "@/hooks/queries/use-system"
import { DashboardSidebar } from "./dashboard-sidebar"
import { DashboardHeader } from "./dashboard-header"
import { DashboardContent } from "./dashboard-content"
import { ArqueoModal } from "./arqueo-modal"
import { AperturaModal } from "./apertura-modal"
import { SalesModule } from "./sales-module"
import { InventoryModule } from "./inventory-module"
import { UsersModule } from "./users-module"
import { PurchasesModule } from "./purchases-module"
import { ClientsModule } from "./clients-module"
import { SuppliersModule } from "./suppliers-module"
import { HelpModule } from "./help-module"
import { PreferencesModule } from "./preferences-module"
import { SettingsModule } from "./settings-module"
import { ReportsModule } from "./reports-module"
import { AccountModule } from "./account-module"
import { ProfileModule } from "./profile-module"

interface DashboardScreenProps {
  onLogout: () => void
  currentUser?: any
}

export function DashboardScreen({ onLogout, currentUser }: DashboardScreenProps) {
  const [activeNav, setActiveNav] = useState("Dashboard")
  const [showArqueo, setShowArqueo] = useState(false)
  const [showApertura, setShowApertura] = useState(false)
  const { data: config } = useSystemStatus()
  const exchangeRate = config?.current_exchange_rate_bs || 36.5

  const renderContent = () => {
    switch (activeNav) {
      case "Ventas":
        return <SalesModule />
      case "Compras":
        return <PurchasesModule />
      case "Inventario":
        return <InventoryModule />
      case "Usuarios":
        return <UsersModule />
      case "Clientes":
        return <ClientsModule />
      case "Proveedores":
        return <SuppliersModule />
      case "Reportes":
        return <ReportsModule />
      case "Configuraciones":
        return <SettingsModule />
      case "Preferencias":
        return <PreferencesModule />
      case "Cuenta":
        return <AccountModule />
      case "Perfil":
        return <ProfileModule />
      case "Ayuda":
        return <HelpModule />
      case "Dashboard":
      default:
        return (
          <DashboardContent 
            onOpenCaja={() => setShowApertura(true)}
            onCloseCaja={() => setShowArqueo(true)} 
          />
        )
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <DashboardSidebar activeItem={activeNav} onItemClick={setActiveNav} />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <DashboardHeader
          title={activeNav === "Dashboard" ? "Caja Principal" : activeNav}
          exchangeRate={exchangeRate}
          onLogout={onLogout}
          onNavigate={setActiveNav}
          currentUser={currentUser}
          onOpenCaja={() => setShowApertura(true)}
          onCloseCaja={() => setShowArqueo(true)}
        />

        {/* Dynamic Content */}
        {renderContent()}
      </div>

      {/* Modals */}
      <AperturaModal
        open={showApertura}
        onClose={() => setShowApertura(false)}
      />

      <ArqueoModal
        open={showArqueo}
        onClose={() => setShowArqueo(false)}
      />
    </div>
  )
}
