"use client"

import { useEffect, useState } from "react"
import { useSystemStatus } from "@/hooks/queries/use-system"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Banknote,
  CreditCard,
  DollarSign,
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
  { icon: Banknote, label: "Efectivo USD", usd: 342.64, color: "text-emerald-500" },
  { icon: Banknote, label: "Efectivo Bs", usd: 0.43, color: "text-blue-500" },
  { icon: CreditCard, label: "Débito", usd: 0.00, color: "text-purple-500" },
  { icon: Smartphone, label: "Transferencia", usd: 0.00, color: "text-sky-500" },
  { icon: QrCode, label: "Pago Móvil", usd: 0.00, color: "text-pink-500" },
  { icon: Wallet, label: "Biopago", usd: 0.00, color: "text-orange-500" },
  { icon: ArrowRightLeft, label: "Zelle", usd: 47.21, color: "text-amber-500" },
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
    <div className="flex-1 overflow-auto bg-slate-50 dark:bg-background/50">
      <div className="flex flex-col gap-4 p-6">

        {/* Top Header Row (Caja and Clock) */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2 shadow-sm">
            {activeSession ? (
              <>
                <span className="font-semibold text-foreground text-sm">
                  Caja Abierta: {activeSession.user_name}
                </span>
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <button
                  onClick={onCloseCaja}
                  className="ml-1 rounded-lg border border-purple-200 bg-purple-50/50 px-4 py-1.5 text-sm font-medium text-purple-600 hover:bg-purple-100/50 transition-colors dark:border-purple-900 dark:bg-purple-900/20 dark:text-purple-400"
                >
                  Cerrar Caja
                </button>
              </>
            ) : (
              <>
                <span className="font-semibold text-muted-foreground text-sm">
                  Caja Cerrada
                </span>
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                <button
                  onClick={onOpenCaja}
                  className="ml-1 rounded-lg border border-purple-200 bg-purple-50/50 px-4 py-1.5 text-sm font-medium text-purple-600 hover:bg-purple-100/50 transition-colors dark:border-purple-900 dark:bg-purple-900/20 dark:text-purple-400"
                >
                  Abrir Caja
                </button>
              </>
            )}
          </div>
          
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {formattedDate} • {formattedTime}
          </p>
        </div>

        {/* Payment method cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {paymentMethods.map((method) => (
            <Card key={method.label} className="border-border shadow-sm hover:shadow-md transition-shadow bg-card rounded-xl">
              <CardHeader className="pb-1 pt-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary/80">
                    <method.icon className={`h-3.5 w-3.5 ${method.color}`} />
                  </div>
                  <CardTitle className="text-xs font-semibold text-foreground">
                    {method.label}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-0.5">
                <p className="text-xl font-bold text-foreground tracking-tight">
                  ${method.usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {method.bs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Totals banner */}
        <Card className="border-border shadow-sm bg-card rounded-xl">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
                  <DollarSign className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Totales Globales
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Suma de todos los métodos de pago
                  </p>
                </div>
              </div>
              <div className="flex gap-12 items-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total USD</p>
                  <p className="text-2xl font-bold text-foreground">
                    ${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Bs</p>
                  <p className="text-2xl font-bold text-foreground">
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
