"use client"

import { useState, useEffect } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { UserPlus } from "lucide-react"
import { useCreateClient, Client } from "@/hooks/queries/use-clients"
import { toast } from "sonner"

const clientSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  email: z.string().email("Correo electrónico inválido").or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  identification_type: z.enum(["CI", "RIF", "Pasaporte"]),
  identification_number: z.string().min(5, "Número de identificación requerido"),
  credit_limit: z.coerce.number().min(0).default(0),
  current_debt: z.coerce.number().min(0).default(0),
  is_active: z.boolean().default(true),
})

type ClientFormValues = z.infer<typeof clientSchema>

interface QuickClientModalProps {
  open: boolean
  onClose: () => void
  initialIdNumber: string
  onClientCreated: (client: Client) => void
}

export function QuickClientModal({ open, onClose, initialIdNumber, onClientCreated }: QuickClientModalProps) {
  const createMutation = useCreateClient()

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      identification_type: "CI",
      identification_number: initialIdNumber || "",
      credit_limit: 0,
      current_debt: 0,
      is_active: true,
    }
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: "",
        email: "",
        phone: "",
        address: "",
        identification_type: "CI",
        identification_number: initialIdNumber,
        credit_limit: 0,
        current_debt: 0,
        is_active: true,
      })
    }
  }, [open, initialIdNumber, form])

  const onSubmit = async (data: ClientFormValues) => {
    try {
      // Si no puso email, enviamos un default para que API no falle si es requerido (dependiendo del backend)
      const submitData = {
          ...data,
          email: data.email || `${data.identification_number}@cliente.local` 
      }
      const newClient = await createMutation.mutateAsync(submitData)
      toast.success("Cliente registrado exitosamente")
      onClientCreated(newClient)
      onClose()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Error al registrar cliente")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-[450px] shadow-2xl rounded-2xl border-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-primary/5 border-b border-border">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <span className="p-2 rounded-lg bg-primary/10 text-primary">
              <UserPlus className="h-5 w-5"/>
            </span>
            Nuevo Cliente Rápido
          </DialogTitle>
          <DialogDescription>
             El documento <strong>{initialIdNumber}</strong> no está registrado. Ingrese los datos obligatorios.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre o Empresa *</FormLabel>
                  <FormControl><Input placeholder="Juan Pérez / ACME CA" {...field} className="bg-background" autoFocus /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl><Input type="email" placeholder="correo@ejemplo.com" {...field} className="bg-background" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="identification_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Identificación *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="CI">Cédula de Identidad (CI)</SelectItem>
                      <SelectItem value="RIF">RIF</SelectItem>
                      <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="identification_number" render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Identificación *</FormLabel>
                  <FormControl><Input placeholder="V-12345678" {...field} className="bg-background" disabled /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl><Input placeholder="+58 412..." {...field} className="bg-background" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección Fiscal</FormLabel>
                  <FormControl><Input placeholder="Calle, Ciudad, Zona..." {...field} className="bg-background" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="bg-secondary/30 p-5 rounded-2xl border-2 border-primary/10 grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="credit_limit" render={({ field }) => (
                <FormItem>
                  <FormLabel>Límite de Crédito ($)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input type="number" step="0.01" {...field} className="pl-7 bg-background font-mono" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="current_debt" render={({ field }) => (
                <FormItem>
                  <FormLabel>Deuda Actual ($)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold">$</span>
                      <Input type="number" step="0.01" {...field} className="pl-7 bg-background font-mono border-amber-500/30 focus-visible:ring-amber-500/40" disabled />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="is_active" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4 bg-muted/20">
                <div className="space-y-0.5">
                  <FormLabel className="text-base text-foreground">Estado del Cliente</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Mantén activo al cliente para poder realizar ventas a crédito o facturación directa.
                  </p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )} />

            <DialogFooter className="pt-4 sticky bottom-0 z-10 bg-background pb-2 mt-4 gap-2">
              <Button type="button" variant="ghost" className="px-6 h-12 rounded-xl" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="flex-1 h-12 rounded-xl shadow-lg shadow-primary/20 font-bold text-lg">
                Guardar Cliente
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
