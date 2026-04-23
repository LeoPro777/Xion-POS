// filepath: src/components/pos/apertura-modal.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useOpenSession } from "@/hooks/queries/use-cash-register"
import { useUsers } from "@/hooks/queries/use-users"

interface AperturaModalProps {
  open: boolean
  onClose: () => void
}

import { toast } from "sonner"

export function AperturaModal({ open, onClose }: AperturaModalProps) {
  const [openingBalance, setOpeningBalance] = useState("0")
  const { data: users, isLoading: loadingUsers } = useUsers()
  const openMutation = useOpenSession()

  const handleConfirm = async () => {
    // Si no hay usuarios, no podemos abrir caja (regla del backend)
    const userId = users && users.length > 0 ? users[0].id : null
    
    if (!userId) {
      toast.error("No hay usuarios registrados para abrir la caja.")
      return
    }

    try {
      console.log("Intentando abrir caja con usuario:", userId, "monto:", openingBalance)
      await openMutation.mutateAsync({
        user_id: userId,
        opening_balance_usd: parseFloat(openingBalance) || 0
      })
      onClose()
    } catch (err: any) {
      console.error("Error catched in modal:", err)
      toast.error(err.response?.data?.detail || "Error interno al abrir caja")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Apertura de Caja</DialogTitle>
          <DialogDescription>
            Ingresa el monto inicial (Fondo de Caja) para comenzar el turno.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="balance" className="text-base font-semibold">
              Monto Inicial (USD)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
                $
              </span>
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="pl-8 text-lg font-mono"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Este monto se sumará al total esperado al final del turno.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={openMutation.isPending}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={openMutation.isPending || loadingUsers}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 font-bold"
          >
            {openMutation.isPending ? "Abriendo..." : "Abrir Turno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
