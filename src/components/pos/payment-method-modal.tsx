"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreatePaymentMethod, useUpdatePaymentMethod, useUploadPaymentMethodImage, PaymentMethod } from "@/hooks/queries/use-payment-methods"
import { toast } from "sonner"
import { Upload, Image as ImageIcon } from "lucide-react"

interface PaymentMethodModalProps {
  open: boolean
  onClose: () => void
  method?: PaymentMethod | null
}

export function PaymentMethodModal({ open, onClose, method }: PaymentMethodModalProps) {
  const isEditing = !!method
  
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [currency, setCurrency] = useState("VES")
  const [allowDecimals, setAllowDecimals] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [imageId, setImageId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const createMutation = useCreatePaymentMethod()
  const updateMutation = useUpdatePaymentMethod()
  const uploadMutation = useUploadPaymentMethodImage()

  useEffect(() => {
    if (open) {
      if (method) {
        setName(method.name)
        setCode(method.code)
        setCurrency(method.currency)
        setAllowDecimals(method.allow_decimals)
        setIsActive(method.is_active)
        setImageId(method.image_url || null)
      } else {
        setName("")
        setCode("")
        setCurrency("VES")
        setAllowDecimals(true)
        setIsActive(true)
        setImageId(null)
      }
    }
  }, [open, method])

  // Regla de negocio: Efectivo no permite decimales (o sugerimos forzar).
  // Si el usuario cambia a Efectivo, podemos deshabilitarlo dinámicamente.
  useEffect(() => {
    if (code.toLowerCase().includes("efectivo")) {
      setAllowDecimals(false)
    }
  }, [code])

  const generateCode = (val: string) => {
    if (isEditing && method?.is_system) return // System codes can't be changed
    const autoCode = val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    setCode(autoCode)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      const res = await uploadMutation.mutateAsync({ file, oldImageId: imageId })
      setImageId(res.image_id)
      toast.success("Imagen subida con éxito.")
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error subiendo imagen")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSave = async () => {
    if (!name || !code) {
      toast.error("Nombre y código son requeridos.")
      return
    }

    try {
      if (isEditing && method) {
        await updateMutation.mutateAsync({
          id: method.id!,
          data: {
            name: method.is_system ? undefined : name,
            currency: method.is_system ? undefined : currency,
            allow_decimals: method.is_system ? undefined : allowDecimals,
            is_active: isActive,
            image_url: imageId
          }
        })
        toast.success("Método actualizado correctamente.")
      } else {
        await createMutation.mutateAsync({
          name,
          code,
          currency,
          allow_decimals: allowDecimals,
          is_active: isActive,
          image_url: imageId
        })
        toast.success("Método creado correctamente.")
      }
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error guardando el método de pago.")
    }
  }

  const backendBaseUrl = 'http://127.0.0.1:8000'
  const imageUrl = imageId ? `${backendBaseUrl}/static/payment_methods/thumb_${imageId}.webp` : null
  const isSystem = method?.is_system

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="w-[90vw] max-w-md shadow-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {isEditing ? "Editar Método de Pago" : "Nuevo Método de Pago"}
          </DialogTitle>
          <DialogDescription className="sr-only">
             Administrar métodos de pago en el POS
          </DialogDescription>
          {isSystem && (
            <p className="text-xs text-amber-600 font-bold mt-1 uppercase">
              Método de sistema. Campos estructurales bloqueados.
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nombre a Mostrar</Label>
            <Input 
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!isEditing) generateCode(e.target.value)
              }}
              placeholder="Ej. Binance Pay"
              disabled={isSystem}
            />
          </div>

          <div className="space-y-2">
            <Label>Código Interno</Label>
            <Input 
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="binance_pay"
              disabled={isEditing} // El código nunca se edita una vez creado
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Moneda Base</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={isSystem}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VES">Bolívares (VES)</SelectItem>
                  <SelectItem value="USD">Dólares (USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2 flex flex-col justify-center">
              <div className="flex items-center justify-between pt-6">
                <Label className="cursor-pointer" onClick={() => !isSystem && setAllowDecimals(!allowDecimals)}>Admite Decimales</Label>
                <Switch checked={allowDecimals} onCheckedChange={setAllowDecimals} disabled={isSystem || code.includes("efectivo")} />
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
             <div className="flex items-center justify-between">
                <Label className="cursor-pointer" onClick={() => setIsActive(!isActive)}>Habilitado en POS</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
             </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label>Imagen Representativa</Label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {imageUrl ? (
                   <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                   <ImageIcon className="h-6 w-6 text-muted-foreground opacity-50" />
                )}
              </div>
              <div className="flex-1">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/jpeg, image/png, image/webp"
                  onChange={handleImageUpload}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4" />
                  {isUploading ? "Subiendo..." : (imageId ? "Cambiar Imagen" : "Subir Imagen")}
                </Button>
              </div>
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={handleSave} 
            disabled={createMutation.isPending || updateMutation.isPending}
            className="bg-primary text-primary-foreground"
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
