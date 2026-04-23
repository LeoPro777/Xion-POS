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
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
  Search,
  UserPlus,
  Edit,
  Trash2,
  Building2,
  Mail,
  Phone,
  Upload,
  Download,
} from "lucide-react"

import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  Supplier,
} from "@/hooks/queries/use-suppliers"
import { toast } from "sonner"

const supplierSchema = z.object({
  name: z.string().min(2, "El nombre de la empresa es obligatorio"),
  email: z.string().email("Correo electrónico inválido"),
  phone: z.string().optional(),
  address: z.string().optional(),
  identification_type: z.enum(["RIF", "CI", "Pasaporte"]),
  identification_number: z.string().min(5, "Número de identificación requerido"),
  category: z.string().min(1, "La categoría es obligatoria"),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
})

type SupplierFormValues = z.infer<typeof supplierSchema>

const categories = [
  "Bebidas",
  "Alimentos",
  "Snacks",
  "Limpieza",
  "Equipos",
  "Varios",
]

export function SuppliersModule() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  const { data: suppliers = [] } = useSuppliers()
  const createMutation = useCreateSupplier()
  const updateMutation = useUpdateSupplier()
  const deleteMutation = useDeleteSupplier()

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      identification_type: "RIF",
      identification_number: "",
      category: "Varios",
      payment_terms: "",
      notes: "",
      is_active: true,
    }
  })

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.identification_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalSuppliers = suppliers.length
  const activeSuppliers = suppliers.filter((s) => s.is_active).length

  const openDialog = (supplier?: Supplier) => {
    form.reset()
    if (supplier) {
      setEditingSupplier(supplier)
      form.reset({
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone || "",
        address: supplier.address || "",
        identification_type: supplier.identification_type as any,
        identification_number: supplier.identification_number,
        category: supplier.category,
        payment_terms: supplier.payment_terms || "",
        notes: supplier.notes || "",
        is_active: supplier.is_active,
      })
    } else {
      setEditingSupplier(null)
      form.reset({
        name: "",
        email: "",
        phone: "",
        address: "",
        identification_type: "RIF",
        identification_number: "",
        category: "Varios",
        payment_terms: "",
        notes: "",
        is_active: true,
      })
    }
    setShowDialog(true)
  }

  const onSubmit = async (data: SupplierFormValues) => {
    try {
      if (editingSupplier) {
        await updateMutation.mutateAsync({ id: editingSupplier.id, data })
        toast.success("Proveedor actualizado exitosamente")
      } else {
        await createMutation.mutateAsync(data)
        toast.success("Proveedor registrado exitosamente")
      }
      setShowDialog(false)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Error al procesar el proveedor")
    }
  }

  const toggleSupplierStatus = async (supplier: Supplier) => {
    try {
      await updateMutation.mutateAsync({
        id: supplier.id,
        data: { is_active: !supplier.is_active }
      })
      toast.success(supplier.is_active ? "Proveedor desactivado" : "Proveedor activado")
    } catch (e) {
      toast.error("Error al cambiar estado")
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("¿Está seguro de eliminar este proveedor de forma permanente?")) {
      try {
        await deleteMutation.mutateAsync(id)
        toast.success("Proveedor eliminado")
      } catch (e) {
        toast.error("Error al eliminar proveedor")
      }
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background/50">
      {/* Header Stats */}
      <div className="border-b border-border bg-card/50 p-6">
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="border-border/50 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" /> Total Proveedores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{totalSuppliers}</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" /> Proveedores Activos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">
                {activeSuppliers}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Actions */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar proveedores por nombre, email, identificación o categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-12 rounded-xl border-border bg-card pr-4 pl-12 shadow-sm focus-visible:ring-primary/20 text-base"
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="gap-2 rounded-xl border h-12 font-semibold shadow-sm"
              onClick={() => alert("Próximamente")}
            >
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Button
              onClick={() => openDialog()}
              className="h-12 gap-2 rounded-xl bg-primary px-6 text-primary-foreground shadow-md font-semibold"
            >
              <UserPlus className="h-5 w-5" /> Nuevo Proveedor
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
                <TableHead className="font-semibold text-foreground">Proveedor</TableHead>
                <TableHead className="font-semibold text-foreground">Contacto</TableHead>
                <TableHead className="font-semibold text-foreground">Identificación</TableHead>
                <TableHead className="font-semibold text-foreground">Categoría</TableHead>
                <TableHead className="font-semibold text-foreground">Términos de Pago</TableHead>
                <TableHead className="text-center font-semibold text-foreground">Estado</TableHead>
                <TableHead className="text-right pr-6 font-semibold text-foreground">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id} className="border-border hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-sm ring-1 ring-primary/20">
                        <Building2 className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {supplier.name}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]" title={supplier.address}>
                          {supplier.address || "Sin dirección"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate">{supplier.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{supplier.phone || "No especificado"}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono bg-background">
                      {supplier.identification_type}-{supplier.identification_number}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-primary text-primary-foreground border-0 shadow-sm font-bold">
                      {supplier.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-sm text-muted-foreground">
                    {supplier.payment_terms || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={supplier.is_active}
                      onCheckedChange={() => toggleSupplierStatus(supplier)}
                    />
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="hover:bg-primary/10 hover:text-primary" onClick={() => openDialog(supplier)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(supplier.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredSuppliers.length === 0 && (
                 <TableRow>
                   <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                     No se encontraron proveedores.
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
                {editingSupplier ? <Edit className="h-5 w-5"/> : <UserPlus className="h-5 w-5"/>}
              </span>
              {editingSupplier ? "Editar Proveedor" : "Registrar Proveedor"}
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground ml-11">
              Complete la información técnica y de contacto del proveedor.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
              
              <div className="grid gap-4 md:grid-cols-2">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2 md:col-span-1">
                    <FormLabel>Nombre de la Empresa *</FormLabel>
                    <FormControl><Input placeholder="Distribuidora ACME CA" {...field} className="bg-background"/></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem className="col-span-2 md:col-span-1">
                    <FormLabel>Email *</FormLabel>
                    <FormControl><Input type="email" placeholder="ventas@ejemplo.com" {...field} className="bg-background"/></FormControl>
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
                        <SelectItem value="RIF">RIF</SelectItem>
                        <SelectItem value="CI">Cédula de Identidad (CI)</SelectItem>
                        <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="identification_number" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Identificación *</FormLabel>
                    <FormControl><Input placeholder="J-12345678" {...field} className="bg-background"/></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl><Input placeholder="+58 412..." {...field} className="bg-background"/></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección Fiscal</FormLabel>
                  <FormControl><Input placeholder="Calle, Ciudad, Zona..." {...field} className="bg-background"/></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="payment_terms" render={({ field }) => (
                <FormItem>
                  <FormLabel>Términos de Pago</FormLabel>
                  <FormControl><Input placeholder="Ej: Pago a 30 días, Crédito semanal..." {...field} className="bg-background"/></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas y Referencias</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Información adicional sobre el proveedor, tiempos de entrega..." {...field} className="min-h-[80px] bg-background resize-none"/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="is_active" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/60 p-4 bg-muted/30">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base text-foreground">Estado del Proveedor</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Activa o inactiva este proveedor en el sistema.
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />

              <DialogFooter className="pt-4 sticky bottom-0 z-10 bg-background pb-2 mt-4 gap-2 border-t">
                <Button type="button" variant="ghost" className="px-6 h-12 rounded-xl" onClick={() => setShowDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 h-12 rounded-xl shadow-lg shadow-primary/20 font-bold text-lg">
                  {editingSupplier ? "Actualizar Proveedor" : "Guardar Proveedor"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
