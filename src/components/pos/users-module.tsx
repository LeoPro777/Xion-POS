"use client"

import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
  Search,
  Plus,
  Edit,
  Trash2,
  UserCircle,
  Shield,
  Users as UsersIcon,
  UserCog,
  Check,
  QrCode, // Para credenciales
} from "lucide-react"

import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  User,
} from "@/hooks/queries/use-users"
import { toast } from "sonner"
import { SupervisorBadge } from "./supervisor-badge"


const userSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  email: z.string().email("Correo electrónico inválido"),
  role: z.enum(["admin", "manager", "cashier", "viewer"]),
  status: z.enum(["active", "inactive"]),
  perm_sales: z.boolean().default(false),
  perm_inventory: z.boolean().default(false),
  perm_reports: z.boolean().default(false),
  perm_users: z.boolean().default(false),
})

type UserFormValues = z.infer<typeof userSchema>

const roleColors = {
  admin: "bg-primary text-primary-foreground",
  manager: "bg-primary text-primary-foreground",
  cashier: "bg-primary text-primary-foreground",
  viewer: "bg-primary text-primary-foreground",
}

const roleLabels = {
  admin: "Administrador",
  manager: "Gerente",
  cashier: "Cajero",
  viewer: "Visualizador",
}

export function UsersModule() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [badgeUser, setBadgeUser] = useState<User | null>(null)
  const [isBadgeOpen, setIsBadgeOpen] = useState(false)

  const handleShowBadge = (user: User) => {
    setBadgeUser(user)
    setIsBadgeOpen(true)
  }

  const { data: users = [] } = useUsers()
  const createMutation = useCreateUser()
  const updateMutation = useUpdateUser()
  const deleteMutation = useDeleteUser()

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "viewer",
      status: "active",
      perm_sales: false,
      perm_inventory: false,
      perm_reports: false,
      perm_users: false,
    }
  })

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeUsers = users.filter((u) => u.status === "active").length
  const adminUsers = users.filter((u) => u.role === "admin").length

  const handleOpenDialog = (user?: User) => {
    form.reset()
    if (user) {
      setEditingUser(user)
      form.reset({
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        perm_sales: user.perm_sales,
        perm_inventory: user.perm_inventory,
        perm_reports: user.perm_reports,
        perm_users: user.perm_users,
      })
    } else {
      setEditingUser(null)
      form.reset({
        name: "",
        email: "",
        role: "viewer",
        status: "active",
        perm_sales: false,
        perm_inventory: false,
        perm_reports: false,
        perm_users: false,
      })
    }
    setIsAddDialogOpen(true)
  }

  const onSubmit = async (data: UserFormValues) => {
    try {
      if (editingUser) {
        await updateMutation.mutateAsync({ id: editingUser.id, data })
        toast.success("Usuario actualizado correctamente")
      } else {
        await createMutation.mutateAsync(data)
        toast.success("Usuario registrado correctamente")
      }
      setIsAddDialogOpen(false)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Ha ocurrido un error al guardar el usuario")
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este usuario?")) {
      try {
        await deleteMutation.mutateAsync(id)
        toast.success("Usuario eliminado")
      } catch (e) {
        toast.error("Error al eliminar el usuario")
      }
    }
  }

  const handleToggleStatus = async (user: User) => {
    try {
      await updateMutation.mutateAsync({
        id: user.id,
        data: { status: user.status === "active" ? "inactive" : "active" }
      })
      toast.success(user.status === "active" ? "Usuario desactivado" : "Usuario activado")
    } catch (e) {
      toast.error("Error al cambiar estado")
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6 bg-background/50">
      {/* Header with stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border-border/50 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex gap-2 items-center text-sm font-medium text-muted-foreground">
              <UsersIcon className="h-4 w-4" /> Total Usuarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{users.length}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex gap-2 items-center text-sm font-medium text-muted-foreground">
              <Check className="h-4 w-4 text-primary" /> Usuarios Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-primary">{activeUsers}</p>
              <Badge className="bg-primary text-primary-foreground border-0 shadow-sm font-bold">Online</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex gap-2 items-center text-sm font-medium text-muted-foreground">
              <Shield className="h-4 w-4 text-primary" /> Administradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-primary">{adminUsers}</p>
              <Badge className="bg-primary text-primary-foreground border-0 shadow-sm font-bold">Admin</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex gap-2 items-center text-sm font-medium text-muted-foreground">
              <UserCog className="h-4 w-4 text-muted-foreground" /> Inactivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-muted-foreground">
              {users.length - activeUsers}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and actions */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 rounded-xl border-border bg-card pl-12 shadow-sm focus-visible:ring-primary/20"
          />
        </div>
        <Button
          onClick={() => handleOpenDialog()}
          className="h-12 gap-2 rounded-xl bg-primary px-6 font-semibold shadow-md"
        >
          <Plus className="h-5 w-5" /> Agregar Usuario
        </Button>
      </div>

      {/* Users table */}
      <Card className="flex-1 overflow-auto border-border/50 shadow-md">
        <Table>
          <TableHeader className="sticky top-0 bg-secondary/80 backdrop-blur-md z-10">
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="font-semibold text-foreground">Usuario</TableHead>
              <TableHead className="font-semibold text-foreground">Rol</TableHead>
              <TableHead className="font-semibold text-foreground">Estado</TableHead>
              <TableHead className="font-semibold text-foreground">Permisos</TableHead>
              <TableHead className="font-semibold text-foreground">Último Acceso</TableHead>
              <TableHead className="text-right pr-6 font-semibold text-foreground">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id} className="border-border hover:bg-muted/50 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-primary/20">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {user.name.split(" ").map((n) => n[0]).join("").substring(0,2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`font-black border-0 px-2.5 py-0.5 shadow-sm text-[10px] uppercase tracking-wider ${user.role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                    {roleLabels[user.role]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={user.status === "active"}
                      onCheckedChange={() => handleToggleStatus(user)}
                    />
                    <Badge className={`font-black shadow-sm px-3 border-0 ${user.status === "active" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground opacity-50"}`}>
                      {user.status === "active" ? "ACTIVO" : "INACTIVO"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap max-w-[200px]">
                    {user.perm_sales && <Badge variant="outline" className="text-[10px] bg-background">Ventas</Badge>}
                    {user.perm_inventory && <Badge variant="outline" className="text-[10px] bg-background">Inventario</Badge>}
                    {user.perm_reports && <Badge variant="outline" className="text-[10px] bg-background">Reportes</Badge>}
                    {user.perm_users && <Badge variant="outline" className="text-[10px] bg-background">Usuarios</Badge>}
                    {!user.perm_sales && !user.perm_inventory && !user.perm_reports && !user.perm_users && (
                      <span className="text-xs text-muted-foreground italic">Ninguno</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.last_login || "Nunca"}
                </TableCell>
                <TableCell className="text-right pr-4">
                  <div className="flex justify-end gap-1">
                    {(user.role === "admin" || user.role === "manager") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-primary/10 hover:text-primary"
                        onClick={() => handleShowBadge(user)}
                        title="Ver Credencial QR de Supervisor"
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="hover:bg-primary/10 hover:text-primary" onClick={() => handleOpenDialog(user)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="hover:bg-destructive/10 text-destructive" onClick={() => handleDelete(user.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No se encontraron usuarios.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog Credencial Supervisor */}
      <Dialog open={isBadgeOpen} onOpenChange={setIsBadgeOpen}>
        <DialogContent className="max-w-md border-border/50 shadow-2xl rounded-2xl bg-card">
          <DialogHeader className="pb-3 border-b border-border/50 text-center">
            <DialogTitle className="text-xl font-bold text-foreground">
              Credencial de Aprobación
            </DialogTitle>
            <DialogDescription className="sr-only">
              Visualización de la credencial de autorización y código QR del supervisor seleccionado.
            </DialogDescription>
          </DialogHeader>
          {badgeUser && (
            <SupervisorBadge
              userId={badgeUser.id}
              userName={badgeUser.name}
              userRole={badgeUser.role}
            />
          )}
        </DialogContent>
      </Dialog>


      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 shadow-2xl rounded-2xl border-0">
          <DialogHeader className="p-6 bg-primary/5 border-b border-border sticky top-0 z-10 backdrop-blur-sm">
            <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
              <span className="p-2 rounded-lg bg-primary/10 text-primary">
                {editingUser ? <Edit className="h-5 w-5"/> : <Plus className="h-5 w-5"/>}
              </span>
              {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground ml-11">
              Configura el perfil, rol y permisos del usuario en el sistema.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo *</FormLabel>
                    <FormControl><Input placeholder="Ej: Ana García" {...field} className="bg-background"/></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl><Input type="email" placeholder="usuario@empresa.com" {...field} className="bg-background"/></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol de Sistema</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Administrador (Total)</SelectItem>
                        <SelectItem value="manager">Gerente (Parcial)</SelectItem>
                        <SelectItem value="cashier">Cajero (Ventas)</SelectItem>
                        <SelectItem value="viewer">Visualizador (Solo Lectura)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="active">Activo (Puede Entrar)</SelectItem>
                        <SelectItem value="inactive">Inactivo (Bloqueado)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>

              <div className="space-y-3 pt-2">
                <Label className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Permisos Detallados
                </Label>
                <Card className="border border-border/60 bg-secondary/20 shadow-none">
                  <CardContent className="grid grid-cols-2 gap-4 p-5">
                    
                    <FormField control={form.control} name="perm_sales" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-xl border border-border/50 bg-background p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-600"><UserCircle className="h-5 w-5" /></div>
                          <div>
                            <FormLabel className="font-semibold text-sm">Ventas / POS</FormLabel>
                          </div>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="perm_inventory" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-xl border border-border/50 bg-background p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-amber-500/10 text-amber-600"><Shield className="h-5 w-5" /></div>
                          <div>
                            <FormLabel className="font-semibold text-sm">Inventario</FormLabel>
                          </div>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="perm_reports" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-xl border border-border/50 bg-background p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-blue-500/10 text-blue-600"><UsersIcon className="h-5 w-5" /></div>
                          <div>
                            <FormLabel className="font-semibold text-sm">Reportes</FormLabel>
                          </div>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="perm_users" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-xl border border-border/50 bg-background p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-purple-500/10 text-purple-600"><UserCog className="h-5 w-5" /></div>
                          <div>
                            <FormLabel className="font-semibold text-sm">Config Usuarios</FormLabel>
                          </div>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />

                  </CardContent>
                </Card>
              </div>

              <DialogFooter className="pt-4 sticky bottom-0 z-10 bg-background pb-2 gap-2 mt-4">
                <Button type="button" variant="ghost" onClick={() => setIsAddDialogOpen(false)} className="rounded-xl px-6 h-11">
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 h-11 rounded-xl shadow-lg shadow-primary/20 font-bold">
                  {editingUser ? "Actualizar Usuario" : "Registrar Usuario"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
