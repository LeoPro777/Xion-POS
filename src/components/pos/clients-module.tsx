"use client"

import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Search,
  UserPlus,
  Edit,
  Trash2,
  UserCircle,
  Mail,
  Phone,
  Upload,
  Download,
  DollarSign,
  Users
} from "lucide-react"

import {
  useClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  Client,
} from "@/hooks/queries/use-clients"
import { toast } from "sonner"

const clientSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  email: z.string().email("Correo electrónico inválido"),
  phone: z.string().optional(),
  address: z.string().optional(),
  identification_type: z.enum(["CI", "RIF", "Pasaporte"]),
  identification_number: z.string().min(5, "Número de identificación requerido"),
  credit_limit: z.coerce.number().min(0, "No puede ser negativo"),
  current_debt: z.coerce.number().min(0, "No puede ser negativo"),
  is_active: z.boolean().default(true),
})

type ClientFormValues = z.infer<typeof clientSchema>

export function ClientsModule() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  const { data: clients = [] } = useClients()
  const createMutation = useCreateClient()
  const updateMutation = useUpdateClient()
  const deleteMutation = useDeleteClient()

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      identification_type: "CI",
      identification_number: "",
      credit_limit: 100,
      current_debt: 0,
      is_active: true,
    }
  })

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.identification_number.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalClients = clients.length
  const activeClients = clients.filter((c) => c.is_active).length
  const totalDebt = clients.reduce((sum, c) => sum + c.current_debt, 0)

  const openDialog = (client?: Client) => {
    form.reset()
    if (client) {
      setEditingClient(client)
      form.setValue("name", client.name)
      form.setValue("email", client.email)
      form.setValue("phone", client.phone || "")
      form.setValue("address", client.address || "")
      form.setValue("identification_type", client.identification_type as any)
      form.setValue("identification_number", client.identification_number)
      form.setValue("credit_limit", client.credit_limit)
      form.setValue("current_debt", client.current_debt)
      form.setValue("is_active", client.is_active)
    } else {
      setEditingClient(null)
      form.reset({
        name: "",
        email: "",
        phone: "",
        address: "",
        identification_type: "CI",
        identification_number: "",
        credit_limit: 100,
        current_debt: 0,
        is_active: true,
      })
    }
    setShowDialog(true)
  }

  const onSubmit = async (data: ClientFormValues) => {
    try {
      if (editingClient) {
        await updateMutation.mutateAsync({ id: editingClient.id, data })
        toast.success("Cliente actualizado exitosamente")
      } else {
        await createMutation.mutateAsync(data)
        toast.success("Cliente registrado exitosamente")
      }
      setShowDialog(false)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Error al procesar el cliente")
    }
  }

  const toggleClientStatus = async (client: Client) => {
    try {
      await updateMutation.mutateAsync({
        id: client.id,
        data: { is_active: !client.is_active }
      })
      toast.success(client.is_active ? "Cliente desactivado" : "Cliente activado")
    } catch (e) {
      toast.error("Error al cambiar estado del cliente")
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("¿Está seguro de eliminar este cliente de forma permanente?")) {
      try {
        await deleteMutation.mutateAsync(id)
        toast.success("Cliente eliminado")
      } catch (e) {
        toast.error("Error al eliminar cliente")
      }
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background/50">
      {/* Header Stats */}
      <div className="border-b border-border bg-card/50 p-6">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-border/50 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-muted-foreground"><Users className="w-5 h-5 text-primary" /> Total Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{totalClients}</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-muted-foreground"><UserPlus className="w-5 h-5 text-primary"/> Clientes Activos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{activeClients}</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-muted-foreground"><DollarSign className="w-5 h-5 text-primary" /> Deuda Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">${totalDebt.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Actions */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes por nombre, email o identificación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-12 rounded-xl border-border bg-card pr-4 pl-12 text-base shadow-sm focus-visible:ring-primary/20"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="h-12 gap-2 rounded-xl border font-semibold shadow-sm" onClick={() => alert("Próximamente")}>
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Button
              onClick={() => openDialog()}
              className="h-12 gap-2 rounded-xl shadow-md font-semibold"
            >
              <UserPlus className="h-5 w-5" />
              Nuevo Cliente
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <Card className="border-border/50 shadow-md h-full">
          <Table>
            <TableHeader className="sticky top-0 bg-secondary/80 backdrop-blur-md z-10">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-semibold">Cliente</TableHead>
                <TableHead className="font-semibold">Contacto</TableHead>
                <TableHead className="font-semibold">Identificación</TableHead>
                <TableHead className="text-right font-semibold">Límite Crédito</TableHead>
                <TableHead className="text-right font-semibold">Deuda Actual</TableHead>
                <TableHead className="text-center font-semibold">Estado</TableHead>
                <TableHead className="text-right pr-6 font-semibold">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id} className="border-border hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-sm">
                        <UserCircle className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{client.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]" title={client.address}>{client.address || "Sin dirección"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate">{client.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{client.phone || "No especificado"}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono bg-background">
                      {client.identification_type}-{client.identification_number}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-muted-foreground">
                    ${client.credit_limit.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-black ${client.current_debt > 0 ? "text-destructive" : "text-primary"}`}>
                      ${client.current_debt.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={client.is_active}
                      onCheckedChange={() => toggleClientStatus(client)}
                    />
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openDialog(client)} className="hover:bg-primary/10 hover:text-primary">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(client.id)} className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredClients.length === 0 && (
                 <TableRow>
                   <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                     No se encontraron clientes.
                   </TableCell>
                 </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0 shadow-2xl rounded-2xl border-0">
          <DialogHeader className="p-6 bg-primary/5 border-b border-border sticky top-0 z-10 backdrop-blur-sm">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <span className="p-2 rounded-lg bg-primary/10 text-primary">
                {editingClient ? <Edit className="h-5 w-5"/> : <UserPlus className="h-5 w-5"/>}
              </span>
              {editingClient ? "Editar Cliente" : "Registrar Cliente"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
              
              <div className="grid gap-4 md:grid-cols-2">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre o Empresa *</FormLabel>
                    <FormControl><Input placeholder="Juan Pérez / ACME CA" {...field} className="bg-background" /></FormControl>
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
                    <FormControl><Input placeholder="V-12345678" {...field} className="bg-background" /></FormControl>
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
                <Button type="button" variant="ghost" className="px-6 h-12 rounded-xl" onClick={() => setShowDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 h-12 rounded-xl shadow-lg shadow-primary/20 font-bold text-lg">
                  {editingClient ? "Actualizar Cliente" : "Guardar Cliente"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
