"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, KeyRound, Mail, Clock, ShieldAlert } from "lucide-react"
import { toast } from "sonner"

export function ProfileModule() {
  const user = {
    name: "Cajero de Desarrollo",
    email: "admin@xion.pos",
    role: "Administrador General",
    lastLogin: "Hace 23 minutos",
    permissions: ["Apertura/Cierre", "Inventario", "Reportes Globales", "Configuraciones"]
  }

  const handlePasswordChange = () => {
    toast.success("Solicitud de cambio de PIN enviada al administrador.")
  }

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-auto bg-background/50 p-6">
      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Identity */}
        <Card className="col-span-1 border-border/50 shadow-md">
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
            <Avatar className="h-32 w-32 shadow-xl ring-4 ring-primary/20">
              <AvatarFallback className="bg-gradient-to-tr from-primary to-primary-foreground text-4xl font-bold text-white">
                {user.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-2xl font-bold">{user.name}</h3>
              <p className="text-muted-foreground mb-2">{user.email}</p>
              <Badge variant="default" className="bg-primary">{user.role}</Badge>
            </div>
          </CardContent>
          <CardFooter className="bg-secondary/30 border-t border-border/50 p-4 flex justify-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-4 w-4" /> Último acceso: {user.lastLogin}
          </CardFooter>
        </Card>

        {/* Security and Info */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          <Card className="border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Credenciales de Acceso</CardTitle>
              <CardDescription>Modifica tu PIN de acceso o contraseña de sesión.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="current-pin">PIN Actual</Label>
                <Input id="current-pin" type="password" placeholder="••••" className="max-w-xs font-mono" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-pin">Nuevo PIN</Label>
                <Input id="new-pin" type="password" placeholder="••••" className="max-w-xs font-mono" />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handlePasswordChange}>Actualizar Credenciales</Button>
            </CardFooter>
          </Card>

          <Card className="border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-amber-500" /> Permisos Asignados</CardTitle>
              <CardDescription>Niveles de acceso habilitados para tu usuario local.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {user.permissions.map((perm, idx) => (
                  <Badge key={idx} variant="secondary" className="px-3 py-1 font-medium bg-secondary hover:bg-secondary/80">
                    {perm}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
