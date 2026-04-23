"use client"

import { useEffect, useState } from "react"
import { useSystemStatus } from "@/hooks/queries/use-system"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Banknote,
  CreditCard,
  DollarSign,
  Lock,
  LockOpen,
  Smartphone,
  ArrowRightLeft,
  QrCode,
  Wallet,
  Building,
} from "lucide-react"

interface DashboardContentProps {
  onOpenCaja: () => void
  onCloseCaja: () => void
}

const IconMap: Record<string, React.ElementType> = {
  DollarSign,
  Banknote,
  CreditCard,
  Smartphone,
  QrCode,
  ArrowRightLeft,
  Wallet,
  Building
}

const paymentMethodsMock = [
  { icon: Banknote, label: "Efectivo", usd: 1250.0, color: "text-emerald-600" },
  { icon: CreditCard, label: "Tarjeta", usd: 890.5, color: "text-primary" },
  { icon: ArrowRightLeft, label: "Transferencia", usd: 450.0, color: "text-amber-600" },
  { icon: Smartphone, label: "Pago Movil", usd: 320.75, color: "text-cyan-600" },
]

import { useActiveSession, useOpenSession, useSessionSummary } from "@/hooks/queries/use-cash-register"

export function DashboardContent({ onOpenCaja, onCloseCaja }: DashboardContentProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  
  const { data: activeSession, isLoading: loadingSession } = useActiveSession()
  const { data: summary } = useSessionSummary()

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const { data: config } = useSystemStatus()
  const exchangeRate = config?.current_exchange_rate_bs || 36.5

  const paymentMethodsFromJson = config?.payment_methods_json ? JSON.parse(config.payment_methods_json) : []

  // Mapear los métodos configurados a los montos reales de la sesión
  const paymentMethods = paymentMethodsFromJson.length > 0 
    ? paymentMethodsFromJson.map((method: any) => {
        const realUsd = summary?.payments?.[method.label] || 0.0
        return {
          icon: IconMap[method.icon] || CreditCard, 
          label: method.label, 
          usd: realUsd, 
          bs: realUsd * exchangeRate, 
          color: method.color || "text-primary"
        }
      })
    : paymentMethodsMock.map((method) => {
        // Fallback si no hay configuración: usar etiquetas estándar
        const realUsd = summary?.payments?.[method.label] || 0.0
        return {
          ...method,
          usd: realUsd,
          bs: realUsd * exchangeRate
        }
      })

  const totalUsd = summary?.total_sales_usd || 0.0
  const totalBs = totalUsd * exchangeRate
  const isCajaOpen = !!activeSession

  const formattedDate = currentTime.toLocaleDateString("es-VE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const formattedTime = currentTime.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  return (
    <div className="flex-1 overflow-auto bg-background/50">
      <div className="flex flex-col gap-8 p-8">
        {/* Date/Time section */}
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">{formattedDate}</p>
          <p className="font-mono text-5xl font-bold text-foreground">{formattedTime}</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4">
          <Button
            onClick={onOpenCaja}
            disabled={isCajaOpen || loadingSession}
            className="h-14 gap-3 rounded-xl bg-primary px-8 text-lg font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-lg"
          >
            <LockOpen className="h-6 w-6" />
            Abrir Caja
          </Button>
          <Button
            onClick={onCloseCaja}
            disabled={!isCajaOpen}
            variant="destructive"
            className="h-14 gap-3 rounded-xl px-8 text-lg font-semibold shadow-lg disabled:opacity-50"
          >
            <Lock className="h-6 w-6" />
            Cerrar Caja
          </Button>
        </div>

        {/* Status badge */}
        {isCajaOpen && (
          <div className="inline-flex items-center gap-3 rounded-xl bg-primary px-6 py-4 w-fit shadow-lg shadow-primary/20 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="h-3 w-3 rounded-full bg-primary-foreground animate-pulse" />
            <span className="text-base font-black text-primary-foreground">Caja abierta y lista para transacciones ({activeSession.user_name})</span>
          </div>
        )}

        {/* Payment method cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {paymentMethods.map((method) => (
            <Card key={method.label} className="border-border/50 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-secondary to-accent">
                    <method.icon className={`h-6 w-6 ${method.color}`} />
                  </div>
                  <CardTitle className="text-base font-semibold text-foreground">
                    {method.label}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-3xl font-bold text-foreground">
                  ${method.usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {method.bs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Totals banner */}
        <Card className="border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-lg">
          <CardContent className="p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-lg">
                  <DollarSign className="h-7 w-7 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Totales Globales
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Suma de todos los métodos de pago
                  </p>
                </div>
              </div>
              <div className="flex gap-12">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total USD</p>
                  <p className="text-4xl font-bold text-foreground">
                    ${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Bs</p>
                  <p className="text-4xl font-bold text-foreground">
                    {totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
