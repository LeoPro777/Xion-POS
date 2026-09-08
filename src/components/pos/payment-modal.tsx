"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Banknote,
  CreditCard,
  Smartphone,
  QrCode,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Wallet,
  Building,
} from "lucide-react"
import { useState, useEffect } from "react"
import { SecurityApprovalModal } from "@/components/shared/security-approval-modal"
import type { SalePaymentDTO } from "@/hooks/queries/use-sales"

import { usePaymentMethods, PaymentMethod } from "@/hooks/queries/use-payment-methods"

// Mapa de iconos disponibles para los métodos dinámicos
const IconMap: Record<string, React.ElementType> = {
  DollarSign,
  Banknote,
  CreditCard,
  Smartphone,
  QrCode,
  Wallet,
  Building,
}

interface PaymentModalProps {
  open: boolean
  onClose: () => void
  /** Callback con la lista de pagos validados — contrato multi-pago */
  onConfirm: (payments: SalePaymentDTO[]) => void
  totalAmount: number
  totalAmountBs: number
  exchangeRate: number
}

export function PaymentModal({
  open,
  onClose,
  onConfirm,
  totalAmount,
  totalAmountBs,
  exchangeRate,
}: PaymentModalProps) {
  const { data: paymentMethods = [] } = usePaymentMethods(true)
  
  // Pasos: 1 = Seleccionar métodos, 2 = Llenar montos y comprobantes
  const [step, setStep] = useState<1 | 2>(1)
  
  // Métodos seleccionados
  const [selectedMethodIds, setSelectedMethodIds] = useState<string[]>([])
  
  // Mapa methodId → valor digitado por el cajero (en la moneda del método)
  const [payments, setPayments] = useState<Record<string, string>>({})
  const [references, setReferences] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [focusedInput, setFocusedInput] = useState<string | null>(null)
  const [showSecurityModal, setShowSecurityModal] = useState(false)

  // Reset when opening the modal
  useEffect(() => {
    if (open) {
      setStep(1)
      setSelectedMethodIds([])
      setPayments({})
      setReferences({})
      setNotes({})
      setFocusedInput(null)
    }
  }, [open])

  // -----------------------------------------------------------------------
  // Helpers de cálculo
  // -----------------------------------------------------------------------

  const getMethod = (id: string): PaymentMethod | undefined =>
    paymentMethods.find((m) => m.code === id)

  const isBsMethod = (methodId: string): boolean =>
    getMethod(methodId)?.currency === "VES"

  /** Convierte el monto ingresado a USD, respetando la moneda del método */
  const toUSD = (methodId: string, raw: string): number => {
    const amount = parseFloat(raw) || 0
    return isBsMethod(methodId) ? amount / exchangeRate : amount
  }

  /** Total pagado en USD sumando todos los métodos */
  const calculateTotalPaidUSD = (): number =>
    Object.entries(payments).reduce(
      (sum, [id, val]) => sum + toUSD(id, val),
      0
    )

  const totalPaid = calculateTotalPaidUSD()
  const remaining = totalAmount - totalPaid
  const isComplete = Math.abs(remaining) < 0.01
  const hasOverpayment = remaining < -0.01

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const toggleMethod = (id: string) => {
    setSelectedMethodIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  const handlePaymentChange = (methodId: string, value: string) => {
    setPayments((prev) => ({ ...prev, [methodId]: value }))
  }

  const handleReferenceChange = (methodId: string, value: string) => {
    setReferences((prev) => ({ ...prev, [methodId]: value }))
  }

  const handleNoteChange = (methodId: string, value: string) => {
    setNotes((prev) => ({ ...prev, [methodId]: value }))
  }

  const clearPayments = () => {
    setPayments({})
    setReferences({})
    setNotes({})
    setFocusedInput(null)
  }

  /**
   * "Completar": rellena el método enfocado con el monto exacto
   * para cerrar la diferencia en USD.
   */
  const handleCompletePayment = () => {
    if (!focusedInput) return
    const paidWithoutFocused = Object.entries(payments).reduce(
      (sum, [id, val]) => (id === focusedInput ? sum : sum + toUSD(id, val)),
      0
    )
    const remainingUSD = totalAmount - paidWithoutFocused
    if (remainingUSD <= 0) return

    const valueToSet = isBsMethod(focusedInput)
      ? remainingUSD * exchangeRate
      : remainingUSD

    setPayments((prev) => ({ ...prev, [focusedInput]: valueToSet.toFixed(2) }))
  }

  const handleCreditPayment = () => {
    if (remaining <= 0) return
    setPayments((prev) => ({ ...prev, ["CREDITO"]: remaining.toFixed(2) }))
  }

  const handleProcessSale = () => {
    if (totalAmount > 500) {
      setShowSecurityModal(true)
      return
    }
    executeConfirm()
  }

  /**
   * Construye la lista de SalePaymentDTO con snapshots de los métodos y
   * la envía al padre para que haga el POST a la API.
   */
  const executeConfirm = () => {
    const salePayments: SalePaymentDTO[] = Object.entries(payments)
      .filter(([, val]) => (parseFloat(val) || 0) > 0)
      .map(([methodId, val]) => {
        const method = getMethod(methodId)
        const amountTendered = parseFloat(val) || 0
        const amountUSD = toUSD(methodId, val)
        
        const ref = references[methodId]
        const note = notes[methodId]
        const finalReference = [ref, note].filter(Boolean).join(" | ") || undefined

        return {
          payment_method_id: methodId,
          // Snapshot inmutable del nombre del método
          payment_method_label: method?.name ?? (methodId === "CREDITO" ? "Crédito" : methodId),
          currency: (method?.currency ?? "USD") as "USD" | "VES",
          amount_tendered: amountTendered,
          amount_usd: amountUSD,
          reference_code: finalReference,
        }
      })

    onConfirm(salePayments)
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="w-[95vw] sm:w-fit sm:max-w-fit shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-3 shrink-0">
          <DialogTitle className="text-2xl font-bold text-foreground">
            {step === 1 ? "Seleccionar Métodos de Pago" : "Totalizador de Pagos"}
          </DialogTitle>
          <div className="flex items-center justify-between rounded-xl bg-primary px-7 py-4 shadow-lg border border-primary/20 gap-8">
            <span className="text-sm font-black uppercase tracking-wider text-primary-foreground opacity-90">Total a Pagar:</span>
            <div className="text-right">
              <p className="text-4xl font-black text-primary-foreground leading-tight">
                ${totalAmount.toFixed(2)}
              </p>
              <p className="text-xs font-bold text-primary-foreground/80 mt-1 uppercase">
                Bs {totalAmountBs.toFixed(2)}
              </p>
            </div>
          </div>
        </DialogHeader>

        {step === 1 && (
          <div className="flex-1 overflow-y-auto mt-4 space-y-4">
            {paymentMethods.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                No hay métodos de pago configurados. Ve a{" "}
                <strong>Configuraciones → Formas de Pago</strong> para añadirlos.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {paymentMethods.map((method) => {
                  const IconComponent = IconMap[method.icon ?? ""] ?? CreditCard
                  const isSelected = selectedMethodIds.includes(method.code)
                  return (
                    <div
                      key={method.code}
                      onClick={() => toggleMethod(method.code)}
                      className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center justify-center gap-3 aspect-square transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20"
                          : "border-border bg-card/50 hover:bg-accent/50 hover:border-primary/50"
                      }`}
                    >
                      {method.image_url ? (
                        <img
                          src={`http://127.0.0.1:8000/static/payment_methods/thumb_${method.image_url}.webp`}
                          alt={method.name}
                          className="h-10 w-10 object-cover rounded-md"
                        />
                      ) : (
                        <IconComponent className={`h-10 w-10 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      )}
                      <div className="text-center w-full">
                        <p className={`font-semibold text-sm leading-tight truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {method.name}
                        </p>
                        <Badge
                          variant="outline"
                          className="mt-1 text-[10px] px-1 py-0 uppercase"
                        >
                          {method.currency}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <DialogFooter className="gap-3 pt-4 shrink-0">
              <Button
                variant="outline"
                onClick={onClose}
                className="border-2 hover:bg-accent/50"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={selectedMethodIds.length === 0}
                className="bg-primary px-8 font-black uppercase text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-lg"
              >
                Aceptar
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <>
            <div className="flex-1 overflow-y-auto mt-4 space-y-4 rounded-lg border border-border bg-card/50 p-4">
              {selectedMethodIds.map((methodId) => {
                const method = getMethod(methodId)
                if (!method) return null
                const IconComponent = IconMap[method.icon ?? ""] ?? CreditCard
                return (
                  <div key={method.code} className="space-y-3 bg-background border border-border/50 p-4 rounded-xl shadow-sm">
                    <Label
                      htmlFor={`amount-${method.code}`}
                      className="flex items-center gap-2 text-sm font-semibold text-foreground"
                    >
                      {method.image_url ? (
                        <img
                          src={`http://127.0.0.1:8000/static/payment_methods/thumb_${method.image_url}.webp`}
                          alt={method.name}
                          className="h-5 w-5 object-cover rounded"
                        />
                      ) : (
                        <IconComponent className="h-4 w-4 text-primary" />
                      )}
                      {method.name}
                      <Badge
                        variant="outline"
                        className="ml-auto text-[9px] px-1 py-0 uppercase"
                      >
                        {method.currency}
                      </Badge>
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Monto */}
                      <div className="relative col-span-1 sm:col-span-2">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {isBsMethod(method.code) ? "Bs" : "$"}
                        </span>
                        <Input
                          id={`amount-${method.code}`}
                          type="number"
                          step={method.allow_decimals ? "0.01" : "1"}
                          placeholder={method.allow_decimals ? "0.00" : "0"}
                          value={payments[method.code] ?? ""}
                          onKeyDown={(e) => {
                            if (!method.allow_decimals && (e.key === '.' || e.key === ',')) {
                              e.preventDefault()
                            }
                          }}
                          onChange={(e) => {
                            let val = e.target.value
                            if (!method.allow_decimals) {
                              val = val.replace(/[.,]/g, '')
                            }
                            handlePaymentChange(method.code, val)
                          }}
                          onFocus={() => setFocusedInput(method.code)}
                          className={`h-12 rounded-xl border-primary/30 pl-10 text-right font-mono text-lg focus:border-primary focus:ring-primary ${
                            focusedInput === method.code
                              ? "ring-2 ring-primary border-primary"
                              : ""
                          }`}
                        />
                      </div>
                      {/* Comprobante */}
                      <Input
                        placeholder="N° Comprobante (Opcional)"
                        value={references[method.code] ?? ""}
                        onChange={(e) => handleReferenceChange(method.code, e.target.value)}
                        className="h-10 text-sm rounded-lg"
                      />
                      {/* Nota */}
                      <Input
                        placeholder="Nota (Opcional)"
                        value={notes[method.code] ?? ""}
                        onChange={(e) => handleNoteChange(method.code, e.target.value)}
                        className="h-10 text-sm rounded-lg"
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <Separator className="my-4 shrink-0" />

            {/* Resumen */}
            <div className="space-y-3 shrink-0">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Pagado:</span>
                <span className="font-mono text-lg font-semibold text-foreground">
                  ${totalPaid.toFixed(2)}
                </span>
              </div>
              {payments["CREDITO"] && parseFloat(payments["CREDITO"]) > 0 && (
                <div className="flex items-center justify-between text-sm bg-amber-500/10 p-2 rounded-md border border-amber-500/20">
                  <span className="text-amber-600 font-bold">Aprobado como Crédito:</span>
                  <span className="font-mono text-lg font-black text-amber-600">
                    ${parseFloat(payments["CREDITO"]).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Restante:</span>
                <span
                  className={`font-mono text-lg font-bold ${
                    isComplete
                      ? "text-primary"
                      : hasOverpayment
                        ? "text-amber-600"
                        : "text-destructive"
                  }`}
                >
                  ${Math.abs(remaining).toFixed(2)}
                </span>
              </div>

              {/* Indicador de estado */}
              <div
                className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                  isComplete
                    ? "bg-primary/10 border border-primary/20"
                    : hasOverpayment
                      ? "bg-amber-50 border border-amber-200"
                      : "bg-destructive/10 border border-destructive/20"
                }`}
              >
                {isComplete ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm font-bold text-primary">
                      Pago completo. Listo para procesar.
                    </span>
                  </>
                ) : hasOverpayment ? (
                  <>
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <span className="text-sm font-bold text-amber-700">
                      Sobrepago de ${Math.abs(remaining).toFixed(2)}. Debe dar vuelto.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <span className="text-sm font-bold text-destructive">
                      Faltan ${Math.abs(remaining).toFixed(2)} por pagar.
                    </span>
                  </>
                )}
              </div>
            </div>

            <DialogFooter className="gap-3 pt-4 flex-wrap shrink-0">
              <Button
                variant="outline"
                onClick={clearPayments}
                className="border-2 hover:bg-accent/50"
              >
                Limpiar
              </Button>
              <Button
                variant="outline"
                onClick={handleCompletePayment}
                disabled={!focusedInput || totalAmount <= 0}
                className="border-2 border-primary/50 text-primary hover:bg-primary/10"
              >
                Completar
              </Button>
              <Button
                variant="outline"
                onClick={handleCreditPayment}
                disabled={totalAmount <= 0 || remaining <= 0}
                className="border-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
              >
                Fiar (Crédito)
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="border-2 hover:bg-accent/50"
              >
                Atrás
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="border-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleProcessSale}
                disabled={!isComplete && !hasOverpayment}
                className="bg-primary px-8 font-black uppercase text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-lg"
              >
                Procesar Venta
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>

      <SecurityApprovalModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        onApproved={() => executeConfirm()}
        requiredRole="manager"
        actionDescription={`La venta por monto elevado ($${totalAmount.toFixed(2)}) requiere autorización de un supervisor.`}
      />
    </Dialog>
  )
}
