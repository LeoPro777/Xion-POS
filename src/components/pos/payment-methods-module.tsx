"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreditCard, PlusCircle, Trash2, LayoutGrid, List } from "lucide-react"
import { usePaymentMethods, useDeletePaymentMethod, PaymentMethod } from "@/hooks/queries/use-payment-methods"
import { PaymentMethodModal } from "./payment-method-modal"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function PaymentMethodsModule() {
  const { data: methodsData, isLoading } = usePaymentMethods()
  const deleteMethod = useDeletePaymentMethod()
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)
  const [viewMode, setViewMode] = useState<"cards" | "list">("list")

  useEffect(() => {
    const saved = localStorage.getItem("payment_methods_view_preference")
    if (saved === "list" || saved === "cards") {
      setViewMode(saved)
    }
  }, [])

  const toggleViewMode = (mode: "cards" | "list") => {
    setViewMode(mode)
    localStorage.setItem("payment_methods_view_preference", mode)
  }

  const backendBaseUrl = 'http://127.0.0.1:8000'

  return (
    <div className="flex h-full flex-col overflow-auto bg-background/50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shadow-sm">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Métodos de Pago</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Configura las formas de pago aceptadas en el POS y sus reglas.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border/50">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className={cn("px-2.5 shadow-none", viewMode === "list" && "bg-background shadow-sm")}
              onClick={() => toggleViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              size="sm"
              className={cn("px-2.5 shadow-none", viewMode === "cards" && "bg-background shadow-sm")}
              onClick={() => toggleViewMode("cards")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => { setEditingMethod(null); setIsModalOpen(true) }} className="gap-2 shadow-md">
            <PlusCircle className="h-4 w-4" />
            Añadir Método
          </Button>
        </div>
      </div>

      <div className="px-6 pb-6 pt-4">
        <div className="bg-amber-50/50 border border-amber-200/50 rounded-lg px-4 py-2 mb-6">
          <p className="text-[11px] font-bold text-amber-600 uppercase tracking-tighter">
             Nota: No se pueden eliminar métodos con balance activo (transacciones registradas en el turno). Los métodos de sistema están protegidos.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8 text-muted-foreground font-medium">Cargando métodos de pago...</div>
        ) : viewMode === "list" ? (
          <div className="space-y-2">
            {methodsData?.map((method) => {
              const thumbUrl = method.image_url ? `${backendBaseUrl}/static/payment_methods/thumb_${method.image_url}.webp` : null
              return (
              <div key={method.id} className="flex gap-3 items-center border border-border/50 p-3 rounded-lg bg-card hover:border-primary/30 hover:shadow-sm transition-all group cursor-pointer" onClick={() => {
                  setEditingMethod(method)
                  setIsModalOpen(true)
              }}>
                <div className="w-10 h-10 shrink-0 rounded overflow-hidden border border-border/50 bg-background flex items-center justify-center">
                  {thumbUrl ? (
                    <img src={thumbUrl} alt={method.name} className="w-full h-full object-cover" />
                  ) : (
                    <CreditCard className="h-5 w-5 text-primary/40" />
                  )}
                </div>
                <div className="flex-[2] space-y-1">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2 group-hover:text-primary transition-colors">
                    {method.name} 
                    {method.is_system && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold">Sistema</span>}
                    {!method.is_active && <span className="text-[9px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded uppercase font-bold">Inactivo</span>}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">{method.code}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Moneda</p>
                  <p className="text-sm font-medium">{method.currency}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Decimales</p>
                  <p className="text-sm font-medium">{method.allow_decimals ? "Sí" : "No"}</p>
                </div>
                <div className="flex gap-1">
                  {!method.is_system && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={async (e) => {
                        e.stopPropagation()
                        if (confirm(`¿Seguro que deseas eliminar el método ${method.name}?`)) {
                          try {
                            await deleteMethod.mutateAsync(method.id!)
                            toast.success("Método eliminado")
                          } catch (error: any) {
                            toast.error(error.response?.data?.detail || "Error eliminando el método")
                          }
                        }
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {methodsData?.map((method) => {
              const imageUrl = method.image_url ? `${backendBaseUrl}/static/payment_methods/medium_${method.image_url}.webp` : null
              return (
                <Card 
                  key={method.id} 
                  className={cn(
                    "group relative border-2 border-border/60 bg-card overflow-hidden rounded-xl hover:shadow-lg hover:border-primary/50 flex flex-col transition-all cursor-pointer",
                    !method.is_active && "opacity-60"
                  )}
                  onClick={() => {
                    setEditingMethod(method)
                    setIsModalOpen(true)
                  }}
                >
                  <div className="absolute top-1.5 left-1.5 z-10 pointer-events-none flex flex-col gap-1">
                    {method.is_system && (
                      <span className="px-2 py-0.5 text-[9px] font-black font-mono bg-primary text-primary-foreground rounded shadow-sm border-0 uppercase">
                        SISTEMA
                      </span>
                    )}
                    {!method.is_active && (
                      <span className="px-2 py-0.5 text-[9px] font-black font-mono bg-destructive text-destructive-foreground rounded shadow-sm border-0 uppercase">
                        INACTIVO
                      </span>
                    )}
                  </div>
                  
                  {!method.is_system && (
                    <div className="absolute top-1.5 right-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        className="h-6 w-6 shadow-md rounded-md"
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (confirm(`¿Seguro que deseas eliminar el método ${method.name}?`)) {
                            try {
                              await deleteMethod.mutateAsync(method.id!)
                              toast.success("Método eliminado")
                            } catch (error: any) {
                              toast.error(error.response?.data?.detail || "Error eliminando el método")
                            }
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  <div className="flex-1 bg-muted/20 w-full aspect-square flex items-center justify-center relative border-b border-border/40 p-0 overflow-hidden">
                    {imageUrl ? (
                      <img src={imageUrl} alt={method.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-primary/30 group-hover:scale-105 transition-transform duration-300">
                        <CreditCard className="w-16 h-16 mb-2" />
                      </div>
                    )}
                  </div>

                  <CardContent className="p-3 shrink-0 bg-card flex flex-col gap-1">
                    <div>
                      <p className="text-[10px] font-mono text-muted-foreground leading-none mb-1">{method.code}</p>
                      <h3 className="line-clamp-2 text-sm font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                        {method.name}
                      </h3>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{method.currency}</p>
                      <p className="text-[10px] font-medium text-muted-foreground">{method.allow_decimals ? "Dec" : "No Dec"}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <PaymentMethodModal 
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        method={editingMethod}
      />
    </div>
  )
}
